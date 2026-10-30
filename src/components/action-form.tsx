"use client";

import { useActionState, type ReactNode } from "react";
import type { FormState } from "@/app/(app)/admin/actions";
import { btn } from "./ui";

// A form whose server action returns { error } or { ok } to show under it.
export function ActionForm({
  action,
  submitLabel,
  children,
  className = "space-y-3",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{state.ok}</p>}
      <button type="submit" disabled={pending} className={btn}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
