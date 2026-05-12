"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@kroger/db";
import {
  normalizeQuery,
  productToSnapshot,
  searchProducts,
  type ProductSnapshot,
} from "@kroger/shared";
import { getValidAccessToken } from "@/lib/kroger";

export type SubmitListResult = { error?: string } | null;

const CANDIDATE_LIMIT = 8;
const MAX_QTY = 99;

const requireSession = async () => {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user;
};

const requireKroger = async (
  userId: string,
): Promise<
  | { ok: true; token: string; locationId: string }
  | { ok: false; error: string }
> => {
  const [oauth, user] = await Promise.all([
    prisma.krogerOAuth.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  if (!oauth) return { ok: false, error: "Connect your Kroger account first." };
  if (!user?.homeLocationId)
    return { ok: false, error: "Pick a home store in Settings first." };
  const token = await getValidAccessToken(userId);
  if (!token)
    return { ok: false, error: "Kroger session expired. Reconnect in Settings." };
  return { ok: true, token, locationId: user.homeLocationId };
};

const safeSearch = async (opts: {
  accessToken: string;
  term: string;
  locationId: string;
}): Promise<ProductSnapshot[]> => {
  try {
    const results = await searchProducts({
      accessToken: opts.accessToken,
      term: opts.term,
      locationId: opts.locationId,
      limit: CANDIDATE_LIMIT,
    });
    return results.map(productToSnapshot);
  } catch (e) {
    console.error("product search failed for", opts.term, e);
    return [];
  }
};

type ResolvedItem = {
  rawText: string;
  status: "pending" | "confirmed" | "stale";
  matchedProductId: string | null;
  matchedUpc: string | null;
  matchedSnapshot: ProductSnapshot | null;
  candidates: ProductSnapshot[] | null;
};

// rawText is what the user typed (unchangeable except via the textarea).
// searchTerm is what we send to the Kroger API for fresh candidate lookup —
// defaults to rawText, but "None of these" lets the user refine it.
//
// When a cached ItemMatch exists, freshness validation uses the stored
// match.searchQuery (the query that originally surfaced the picked product)
// so a refined pick like "tillamook sharp cheddar" doesn't get falsely flagged
// stale on a future submit of the broader original phrase "cheddar cheese".
const resolveItem = async (
  rawText: string,
  searchTerm: string,
  ctx: { userId: string; token: string; locationId: string },
): Promise<ResolvedItem> => {
  const normalized = normalizeQuery(rawText);
  const match = await prisma.itemMatch.findUnique({
    where: {
      userId_locationId_normalizedQuery: {
        userId: ctx.userId,
        locationId: ctx.locationId,
        normalizedQuery: normalized,
      },
    },
  });

  if (match) {
    const validationCandidates = await safeSearch({
      accessToken: ctx.token,
      term: match.searchQuery ?? rawText,
      locationId: ctx.locationId,
    });
    const fresh = validationCandidates.find(
      (c) => c.productId === match.productId,
    );
    if (fresh) {
      // Refresh the cached snapshot so the next page render is up to date.
      await prisma.itemMatch.update({
        where: { id: match.id },
        data: { snapshot: fresh, upc: fresh.upc ?? null },
      });
      return {
        rawText,
        status: "confirmed",
        matchedProductId: fresh.productId,
        matchedUpc: fresh.upc ?? null,
        matchedSnapshot: fresh,
        candidates: null,
      };
    }
    // Cached match no longer in current results — mark stale, keep snapshot.
    return {
      rawText,
      status: "stale",
      matchedProductId: match.productId,
      matchedUpc: match.upc,
      matchedSnapshot: match.snapshot as ProductSnapshot,
      candidates: null,
    };
  }

  // No cached match — show the picker with fresh candidates.
  const candidates = await safeSearch({
    accessToken: ctx.token,
    term: searchTerm,
    locationId: ctx.locationId,
  });
  return {
    rawText,
    status: "pending",
    matchedProductId: null,
    matchedUpc: null,
    matchedSnapshot: null,
    candidates,
  };
};

export async function submitListAction(
  _prev: SubmitListResult,
  formData: FormData,
): Promise<SubmitListResult> {
  const user = await requireSession();

  const raw = String(formData.get("items") ?? "");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 50);

  if (lines.length === 0) return { error: "Add at least one item." };

  const ctx = await requireKroger(user.id);
  if (!ctx.ok) return { error: ctx.error };

  const resolved = await Promise.all(
    lines.map((line) =>
      resolveItem(line, line, {
        userId: user.id,
        token: ctx.token,
        locationId: ctx.locationId,
      }),
    ),
  );

  await prisma.shoppingList.create({
    data: {
      userId: user.id,
      items: {
        create: resolved.map((r, idx) => ({
          position: idx,
          rawText: r.rawText,
          status: r.status,
          quantity: 1,
          matchedProductId: r.matchedProductId,
          matchedUpc: r.matchedUpc,
          matchedSnapshot: r.matchedSnapshot ?? undefined,
          candidates: r.candidates ?? undefined,
        })),
      },
    },
  });

  revalidatePath("/");
  return null;
}

// ---------- Per-item actions ----------

const loadItemForUser = async (itemId: string, userId: string) => {
  const item = await prisma.shoppingListItem.findUnique({
    where: { id: itemId },
    include: { list: true },
  });
  if (!item || item.list.userId !== userId) return null;
  return item;
};

export async function pickCandidateAction(formData: FormData) {
  const user = await requireSession();
  const itemId = String(formData.get("itemId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  if (!itemId || !productId) return;

  const item = await loadItemForUser(itemId, user.id);
  if (!item) return;

  const candidates = (item.candidates as ProductSnapshot[] | null) ?? [];
  const picked = candidates.find((c) => c.productId === productId);
  if (!picked) return;

  const ctx = await requireKroger(user.id);
  if (!ctx.ok) return;

  const normalized = normalizeQuery(item.rawText);
  // Remember the actual query that surfaced this product so a future submit of
  // the broader rawText can still validate freshness against it. Null when the
  // user picked from the unrefined search.
  const matchSearchQuery =
    item.searchQuery && item.searchQuery !== item.rawText
      ? item.searchQuery
      : null;

  await prisma.$transaction([
    prisma.itemMatch.upsert({
      where: {
        userId_locationId_normalizedQuery: {
          userId: user.id,
          locationId: ctx.locationId,
          normalizedQuery: normalized,
        },
      },
      create: {
        userId: user.id,
        locationId: ctx.locationId,
        normalizedQuery: normalized,
        searchQuery: matchSearchQuery,
        productId: picked.productId,
        upc: picked.upc ?? null,
        snapshot: picked,
      },
      update: {
        searchQuery: matchSearchQuery,
        productId: picked.productId,
        upc: picked.upc ?? null,
        snapshot: picked,
      },
    }),
    prisma.shoppingListItem.update({
      where: { id: itemId },
      data: {
        status: "confirmed",
        matchedProductId: picked.productId,
        matchedUpc: picked.upc ?? null,
        matchedSnapshot: picked,
        candidates: undefined,
        quantity: item.quantity > 0 ? item.quantity : 1,
      },
    }),
  ]);

  revalidatePath("/");
}

export async function setQuantityAction(formData: FormData) {
  const user = await requireSession();
  const itemId = String(formData.get("itemId") ?? "");
  const delta = Number(formData.get("delta") ?? 0);
  if (!itemId || !Number.isFinite(delta)) return;

  const item = await loadItemForUser(itemId, user.id);
  if (!item || item.status !== "confirmed") return;

  const next = Math.max(1, Math.min(MAX_QTY, item.quantity + delta));
  if (next === item.quantity) return;

  await prisma.shoppingListItem.update({
    where: { id: itemId },
    data: { quantity: next },
  });
  revalidatePath("/");
}

export async function forgetMatchAction(formData: FormData) {
  const user = await requireSession();
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  const item = await loadItemForUser(itemId, user.id);
  if (!item) return;

  const ctx = await requireKroger(user.id);
  if (!ctx.ok) return;

  const normalized = normalizeQuery(item.rawText);

  // Best-effort delete; ignore not-found.
  await prisma.itemMatch
    .delete({
      where: {
        userId_locationId_normalizedQuery: {
          userId: user.id,
          locationId: ctx.locationId,
          normalizedQuery: normalized,
        },
      },
    })
    .catch(() => undefined);

  const candidates = await safeSearch({
    accessToken: ctx.token,
    term: item.searchQuery ?? item.rawText,
    locationId: ctx.locationId,
  });

  await prisma.shoppingListItem.update({
    where: { id: itemId },
    data: {
      status: "pending",
      matchedProductId: null,
      matchedUpc: null,
      matchedSnapshot: undefined,
      candidates,
    },
  });
  revalidatePath("/");
}

// Stale rematch: same as forget (the old cached productId is gone anyway).
export async function rematchAction(formData: FormData) {
  return forgetMatchAction(formData);
}

export async function skipItemAction(formData: FormData) {
  const user = await requireSession();
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  const item = await loadItemForUser(itemId, user.id);
  if (!item) return;

  await prisma.shoppingListItem.update({
    where: { id: itemId },
    data: { status: "skipped" },
  });
  revalidatePath("/");
}

export async function unskipItemAction(formData: FormData) {
  const user = await requireSession();
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  const item = await loadItemForUser(itemId, user.id);
  if (!item || item.status !== "skipped") return;

  const ctx = await requireKroger(user.id);
  if (!ctx.ok) return;

  // Re-resolve from scratch (might find a fresh ItemMatch that was created
  // since this row was skipped). Searches use the refined searchQuery if one
  // was set; ItemMatch lookup always uses the original rawText.
  const resolved = await resolveItem(
    item.rawText,
    item.searchQuery ?? item.rawText,
    {
      userId: user.id,
      token: ctx.token,
      locationId: ctx.locationId,
    },
  );

  await prisma.shoppingListItem.update({
    where: { id: itemId },
    data: {
      status: resolved.status,
      matchedProductId: resolved.matchedProductId,
      matchedUpc: resolved.matchedUpc,
      matchedSnapshot: resolved.matchedSnapshot ?? undefined,
      candidates: resolved.candidates ?? undefined,
    },
  });
  revalidatePath("/");
}

export async function researchAction(formData: FormData) {
  const user = await requireSession();
  const itemId = String(formData.get("itemId") ?? "");
  const newQuery = String(formData.get("newQuery") ?? "").trim();
  if (!itemId || !newQuery) return;

  const item = await loadItemForUser(itemId, user.id);
  if (!item) return;

  const ctx = await requireKroger(user.id);
  if (!ctx.ok) return;

  // Refine the search only — leave rawText alone so the user's typed phrase
  // (and the ItemMatch cache key) doesn't drift. Skip ItemMatch lookup since
  // the user explicitly said "none of these"; just update candidates.
  const candidates = await safeSearch({
    accessToken: ctx.token,
    term: newQuery,
    locationId: ctx.locationId,
  });

  await prisma.shoppingListItem.update({
    where: { id: itemId },
    data: {
      searchQuery: newQuery,
      status: "pending",
      matchedProductId: null,
      matchedUpc: null,
      matchedSnapshot: undefined,
      candidates,
    },
  });
  revalidatePath("/");
}
