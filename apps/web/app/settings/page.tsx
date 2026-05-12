import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@kroger/db";
import {
  getLocation,
  searchLocations,
  type KrogerLocation,
} from "@kroger/shared";
import {
  ConnectKrogerLink,
  DisconnectKrogerButton,
  SetHomeStoreButton,
  StorePickerForm,
} from "@/components/kroger-forms";
import { LogoutButton } from "@/components/forms";
import { getValidAccessToken } from "@/lib/kroger";

type Search = {
  zip?: string;
  krogerConnected?: string;
  krogerError?: string;
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const params = await searchParams;

  const [oauth, user] = await Promise.all([
    prisma.krogerOAuth.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { homeLocationId: true },
    }),
  ]);
  const homeLocationId = user?.homeLocationId ?? null;

  let stores: KrogerLocation[] = [];
  let storeSearchError: string | null = null;
  let homeStore: KrogerLocation | null = null;

  if (oauth) {
    const token = await getValidAccessToken(session.user.id);
    if (token) {
      if (homeLocationId) {
        homeStore = await getLocation({
          accessToken: token,
          locationId: homeLocationId,
        }).catch(() => null);
      }
      if (params.zip) {
        try {
          stores = await searchLocations({
            accessToken: token,
            zipCode: params.zip,
            radiusInMiles: 15,
            limit: 20,
          });
        } catch (e) {
          storeSearchError =
            e instanceof Error ? e.message : "Failed to search stores";
        }
      }
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <Link
            href="/"
            className="text-sm text-neutral-600 underline dark:text-neutral-400"
          >
            Shopping list
          </Link>
        </div>
        <LogoutButton />
      </header>

      {params.krogerConnected ? (
        <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          Kroger account connected.
        </p>
      ) : null}
      {params.krogerError ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          Kroger error: {params.krogerError}
        </p>
      ) : null}

      <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="mb-2 text-lg font-medium">Kroger account</h2>
        {!oauth ? (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Connect your Kroger account so the app can search products at
              your store.
            </p>
            <ConnectKrogerLink />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Connected. Access token expires{" "}
              {oauth.expiresAt.toLocaleString()}.
            </p>
            <p className="text-xs text-neutral-500">
              Scopes: {oauth.scopes || "(none reported)"}
            </p>
            <DisconnectKrogerButton />
          </div>
        )}
      </section>

      {oauth ? (
        <section className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="mb-2 text-lg font-medium">Home store</h2>
          {homeLocationId ? (
            <div className="mb-4 text-sm text-neutral-700 dark:text-neutral-300">
              {homeStore ? (
                <>
                  <p className="font-medium">{homeStore.name}</p>
                  <p className="text-xs text-neutral-500">
                    {homeStore.address?.addressLine1}
                    {homeStore.address?.city ? `, ${homeStore.address.city}` : ""}
                    {homeStore.address?.state ? `, ${homeStore.address.state}` : ""}
                    {homeStore.address?.zipCode
                      ? ` ${homeStore.address.zipCode}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    ID: <code>{homeLocationId}</code>
                  </p>
                </>
              ) : (
                <p>
                  Current home store ID: <code>{homeLocationId}</code>
                </p>
              )}
            </div>
          ) : (
            <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">
              No home store selected. Search by ZIP code below to pick one.
            </p>
          )}

          <StorePickerForm defaultZip={params.zip ?? ""} />

          {storeSearchError ? (
            <p className="mt-3 text-sm text-red-700">{storeSearchError}</p>
          ) : null}

          {stores.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {stores.map((s) => (
                <li
                  key={s.locationId}
                  className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 dark:border-neutral-800"
                >
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-neutral-500">
                      {s.address?.addressLine1}
                      {s.address?.city ? `, ${s.address.city}` : ""}
                      {s.address?.state ? `, ${s.address.state}` : ""}
                      {s.address?.zipCode ? ` ${s.address.zipCode}` : ""}
                    </p>
                  </div>
                  <SetHomeStoreButton
                    locationId={s.locationId}
                    isCurrent={homeLocationId === s.locationId}
                  />
                </li>
              ))}
            </ul>
          ) : params.zip ? (
            <p className="mt-3 text-sm text-neutral-600">No stores found.</p>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
