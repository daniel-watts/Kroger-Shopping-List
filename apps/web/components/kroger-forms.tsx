"use client";

import { useTransition } from "react";
import { disconnectKrogerAction, setHomeStoreAction } from "@/app/_actions/kroger";

export function ConnectKrogerLink() {
  return (
    <a
      href="/api/kroger/connect"
      className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
    >
      Connect Kroger account
    </a>
  );
}

export function DisconnectKrogerButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Disconnect your Kroger account?")) return;
        startTransition(() => disconnectKrogerAction());
      }}
      className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}

export function StorePickerForm({ defaultZip = "" }: { defaultZip?: string }) {
  return (
    <form method="get" action="/settings" className="flex gap-2">
      <input
        type="text"
        name="zip"
        placeholder="ZIP code"
        defaultValue={defaultZip}
        pattern="\d{5}"
        required
        className="w-32 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
      />
      <button
        type="submit"
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
      >
        Search stores
      </button>
    </form>
  );
}

export function SetHomeStoreButton({
  locationId,
  isCurrent,
}: {
  locationId: string;
  isCurrent: boolean;
}) {
  return (
    <form action={setHomeStoreAction}>
      <input type="hidden" name="locationId" value={locationId} />
      <button
        type="submit"
        disabled={isCurrent}
        className="rounded-md border border-neutral-300 px-3 py-1 text-xs hover:bg-neutral-100 disabled:cursor-default disabled:bg-neutral-100 disabled:text-neutral-500 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:disabled:bg-neutral-800"
      >
        {isCurrent ? "Home store" : "Set as home"}
      </button>
    </form>
  );
}
