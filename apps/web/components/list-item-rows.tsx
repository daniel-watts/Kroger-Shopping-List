"use client";

import { useState } from "react";
import Image from "next/image";
import type { ProductSnapshot } from "@kroger/shared";
import {
  forgetMatchAction,
  pickCandidateAction,
  rematchAction,
  researchAction,
  setQuantityAction,
  skipItemAction,
  unskipItemAction,
} from "@/app/_actions/list";

const fmtPrice = (n?: number) =>
  typeof n === "number" ? `$${n.toFixed(2)}` : null;

type ItemRowProps = {
  itemId: string;
  rawText: string;
  searchQuery: string | null;
  quantity: number;
  matchedSnapshot: ProductSnapshot | null;
  candidates: ProductSnapshot[];
};

const PriceLine = ({ snap }: { snap: ProductSnapshot }) => {
  const promo = fmtPrice(snap.pricePromo);
  const regular = fmtPrice(snap.priceRegular);
  return (
    <p className="text-xs text-neutral-500">
      {snap.size ? `${snap.size} · ` : ""}
      {promo ? (
        <>
          <span className="font-semibold text-green-700 dark:text-green-400">
            {promo}
          </span>
          {regular ? (
            <>
              {" "}
              <span className="line-through">{regular}</span>
            </>
          ) : null}
        </>
      ) : (
        regular ?? "price unknown"
      )}
      {snap.upc ? ` · UPC ${snap.upc}` : ""}
    </p>
  );
};

const ProductCard = ({ snap }: { snap: ProductSnapshot }) => (
  <div className="flex gap-3">
    {snap.imageUrl ? (
      <Image
        src={snap.imageUrl}
        alt={snap.description}
        width={64}
        height={64}
        unoptimized
        className="h-16 w-16 shrink-0 rounded-md bg-neutral-100 object-contain"
      />
    ) : (
      <div className="h-16 w-16 shrink-0 rounded-md border border-dashed border-neutral-300 dark:border-neutral-700" />
    )}
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium leading-tight">
        {snap.brand ? `${snap.brand} — ` : ""}
        {snap.description}
      </p>
      <PriceLine snap={snap} />
    </div>
  </div>
);

const itemBox =
  "rounded-md border border-neutral-200 p-3 dark:border-neutral-800";

const subtleBtn =
  "rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";

const dangerBtn =
  "rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950";

const primaryBtn =
  "rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white";

const RawTextHeader = ({
  rawText,
  searchQuery,
}: {
  rawText: string;
  searchQuery?: string | null;
}) => (
  <div>
    <p className="text-sm text-neutral-500">
      You typed:{" "}
      <span className="font-medium text-neutral-900 dark:text-neutral-100">
        {rawText}
      </span>
    </p>
    {searchQuery && searchQuery !== rawText ? (
      <p className="text-xs text-neutral-500">
        Searching for:{" "}
        <span className="font-medium text-neutral-700 dark:text-neutral-300">
          {searchQuery}
        </span>
      </p>
    ) : null}
  </div>
);

const HiddenItemId = ({ itemId }: { itemId: string }) => (
  <input type="hidden" name="itemId" value={itemId} />
);

// ---------- Pending row: candidate picker + research + skip ----------

export function PendingRow({
  itemId,
  rawText,
  searchQuery,
  candidates,
}: ItemRowProps) {
  const [showResearch, setShowResearch] = useState(false);

  return (
    <li className={itemBox}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <RawTextHeader rawText={rawText} searchQuery={searchQuery} />
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          pick one
        </span>
      </div>

      {candidates.length > 0 ? (
        <ul className="space-y-2">
          {candidates.map((c) => (
            <li
              key={c.productId}
              className="flex items-center gap-3 rounded-md border border-neutral-200 p-2 dark:border-neutral-800"
            >
              <div className="min-w-0 flex-1">
                <ProductCard snap={c} />
              </div>
              <form action={pickCandidateAction}>
                <HiddenItemId itemId={itemId} />
                <input type="hidden" name="productId" value={c.productId} />
                <button type="submit" className={primaryBtn}>
                  Pick
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          No matches at your store. Try a different search below.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!showResearch ? (
          <button
            type="button"
            className={subtleBtn}
            onClick={() => setShowResearch(true)}
          >
            None of these
          </button>
        ) : (
          <form
            action={researchAction}
            className="flex flex-1 items-center gap-2"
          >
            <HiddenItemId itemId={itemId} />
            <input
              type="text"
              name="newQuery"
              required
              defaultValue={searchQuery ?? rawText}
              autoFocus
              className="flex-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button type="submit" className={primaryBtn}>
              Search
            </button>
            <button
              type="button"
              className={subtleBtn}
              onClick={() => setShowResearch(false)}
            >
              Cancel
            </button>
          </form>
        )}
        <form action={skipItemAction}>
          <HiddenItemId itemId={itemId} />
          <button type="submit" className={subtleBtn}>
            Skip
          </button>
        </form>
      </div>
    </li>
  );
}

// ---------- Confirmed row: product card + qty stepper + forget ----------

export function ConfirmedRow({
  itemId,
  rawText,
  searchQuery,
  quantity,
  matchedSnapshot,
}: ItemRowProps) {
  if (!matchedSnapshot) return null;
  return (
    <li className={itemBox}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <RawTextHeader rawText={rawText} searchQuery={searchQuery} />
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-900 dark:bg-green-950 dark:text-green-200">
          confirmed
        </span>
      </div>
      <ProductCard snap={matchedSnapshot} />
      <div className="mt-3 flex items-center gap-2">
        <div className="inline-flex items-center rounded-md border border-neutral-300 dark:border-neutral-700">
          <form action={setQuantityAction}>
            <HiddenItemId itemId={itemId} />
            <input type="hidden" name="delta" value="-1" />
            <button
              type="submit"
              disabled={quantity <= 1}
              className="px-2 py-1 text-sm disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              −
            </button>
          </form>
          <span className="min-w-[2ch] px-2 text-center text-sm tabular-nums">
            {quantity}
          </span>
          <form action={setQuantityAction}>
            <HiddenItemId itemId={itemId} />
            <input type="hidden" name="delta" value="1" />
            <button
              type="submit"
              className="px-2 py-1 text-sm"
              aria-label="Increase quantity"
            >
              +
            </button>
          </form>
        </div>
        <form action={forgetMatchAction}>
          <HiddenItemId itemId={itemId} />
          <button type="submit" className={subtleBtn}>
            Forget match
          </button>
        </form>
        <form action={skipItemAction}>
          <HiddenItemId itemId={itemId} />
          <button type="submit" className={subtleBtn}>
            Skip
          </button>
        </form>
      </div>
    </li>
  );
}

// ---------- Stale row: warning + rematch + skip ----------

export function StaleRow({
  itemId,
  rawText,
  searchQuery,
  matchedSnapshot,
}: ItemRowProps) {
  return (
    <li
      className={`${itemBox} border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <RawTextHeader rawText={rawText} searchQuery={searchQuery} />
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
          no longer at store
        </span>
      </div>
      {matchedSnapshot ? (
        <div className="opacity-70">
          <ProductCard snap={matchedSnapshot} />
        </div>
      ) : (
        <p className="text-sm text-amber-900 dark:text-amber-200">
          Previously matched product is no longer returned at your store.
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={rematchAction}>
          <HiddenItemId itemId={itemId} />
          <button type="submit" className={primaryBtn}>
            Rematch
          </button>
        </form>
        <form action={skipItemAction}>
          <HiddenItemId itemId={itemId} />
          <button type="submit" className={subtleBtn}>
            Skip
          </button>
        </form>
      </div>
    </li>
  );
}

// ---------- Skipped row: dimmed + unskip ----------

export function SkippedRow({ itemId, rawText, searchQuery }: ItemRowProps) {
  return (
    <li className={`${itemBox} opacity-60`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <RawTextHeader rawText={rawText} searchQuery={searchQuery} />
          <span className="text-xs text-neutral-500">
            skipped — won't be added to cart
          </span>
        </div>
        <form action={unskipItemAction}>
          <HiddenItemId itemId={itemId} />
          <button type="submit" className={dangerBtn}>
            Unskip
          </button>
        </form>
      </div>
    </li>
  );
}
