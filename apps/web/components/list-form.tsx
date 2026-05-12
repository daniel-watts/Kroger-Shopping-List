"use client";

import { useActionState, useRef } from "react";
import { submitListAction, type SubmitListResult } from "@/app/_actions/list";

export function ListForm({ defaultValue = "" }: { defaultValue?: string }) {
  const [state, action, pending] = useActionState<SubmitListResult, FormData>(
    submitListAction,
    null,
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <form action={action} className="space-y-3">
      <label htmlFor="items" className="block text-sm font-medium">
        Shopping list (one item per line)
      </label>
      <textarea
        id="items"
        name="items"
        ref={textareaRef}
        required
        rows={8}
        placeholder={"milk\neggs\noreos"}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
      />
      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          {pending ? "Matching products…" : "Match products"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const el = textareaRef.current;
            if (!el) return;
            el.value = "";
            el.focus();
          }}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Clear
        </button>
      </div>
    </form>
  );
}
