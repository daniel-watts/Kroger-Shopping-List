import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@kroger/db";
import { getLocation, type KrogerLocation, type ProductSnapshot } from "@kroger/shared";
import { ListForm } from "@/components/list-form";
import { LogoutButton } from "@/components/forms";
import {
  ConfirmedRow,
  PendingRow,
  SkippedRow,
  StaleRow,
} from "@/components/list-item-rows";
import { getValidAccessToken } from "@/lib/kroger";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [oauth, user, list] = await Promise.all([
    prisma.krogerOAuth.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { homeLocationId: true },
    }),
    prisma.shoppingList.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { position: "asc" } } },
    }),
  ]);

  const needsConnect = !oauth;
  const needsStore = oauth && !user?.homeLocationId;

  let homeStore: KrogerLocation | null = null;
  if (oauth && user?.homeLocationId) {
    const token = await getValidAccessToken(session.user.id);
    if (token) {
      homeStore = await getLocation({
        accessToken: token,
        locationId: user.homeLocationId,
      }).catch(() => null);
    }
  }

  const counts = list
    ? list.items.reduce(
        (acc, item) => {
          acc[item.status] = (acc[item.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      )
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Shopping list</h1>
          <Link
            href="/settings"
            className="text-sm text-neutral-600 underline dark:text-neutral-400"
          >
            Settings
          </Link>
        </div>
        <LogoutButton />
      </header>

      {needsConnect ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Connect your Kroger account in{" "}
          <Link href="/settings" className="font-medium underline">
            Settings
          </Link>{" "}
          before adding a list.
        </p>
      ) : needsStore ? (
        <p className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Pick a home store in{" "}
          <Link href="/settings" className="font-medium underline">
            Settings
          </Link>{" "}
          so we know where to look up prices.
        </p>
      ) : (
        <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <ListForm
            key={list?.id ?? "empty"}
            defaultValue={list?.items.map((i) => i.rawText).join("\n") ?? ""}
          />
        </section>
      )}

      {homeStore ? (
        <p className="mb-8 text-sm text-neutral-700 dark:text-neutral-300">
          <span className="font-medium">{homeStore.name}</span>
          <span className="text-neutral-500">
            {" — "}
            {homeStore.address?.addressLine1}
            {homeStore.address?.city ? `, ${homeStore.address.city}` : ""}
            {homeStore.address?.state ? `, ${homeStore.address.state}` : ""}
            {homeStore.address?.zipCode ? ` ${homeStore.address.zipCode}` : ""}
          </span>
        </p>
      ) : null}

      {list ? (
        <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-lg font-medium">
              Last list — {list.createdAt.toLocaleString()}
            </h2>
            {counts ? (
              <p className="text-xs text-neutral-500">
                {counts.confirmed ?? 0} confirmed · {counts.pending ?? 0} pending ·{" "}
                {counts.stale ?? 0} stale · {counts.skipped ?? 0} skipped
              </p>
            ) : null}
          </div>
          <ul className="space-y-3">
            {list.items.map((item) => {
              const props = {
                itemId: item.id,
                rawText: item.rawText,
                searchQuery: item.searchQuery,
                quantity: item.quantity,
                matchedSnapshot:
                  (item.matchedSnapshot as ProductSnapshot | null) ?? null,
                candidates:
                  (item.candidates as ProductSnapshot[] | null) ?? [],
              };
              switch (item.status) {
                case "pending":
                  return <PendingRow key={item.id} {...props} />;
                case "confirmed":
                  return <ConfirmedRow key={item.id} {...props} />;
                case "stale":
                  return <StaleRow key={item.id} {...props} />;
                case "skipped":
                  return <SkippedRow key={item.id} {...props} />;
              }
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
