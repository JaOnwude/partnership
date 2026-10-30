"use client";

import { useActionState, useTransition, type FormEvent } from "react";
import type { FormState } from "@/app/(app)/admin/actions";
import { compressImage } from "@/lib/compress-image";
import { btn } from "./ui";

// "Mark sent" with an optional photo of the transfer receipt.
export function PayoutSentForm({ action }: { action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [compressing, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const proof = formData.get("proof");
    startTransition(async () => {
      if (proof instanceof File && proof.size > 0) formData.set("proof", await compressImage(proof));
      startTransition(() => formAction(formData));
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <label className="text-xs text-foreground/70">
        Transfer receipt (optional)
        <input
          type="file"
          name="proof"
          accept="image/*"
          className="mt-1 block w-52 text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-brand/10 file:px-2 file:py-1 file:text-brand"
        />
      </label>
      <button type="submit" disabled={pending || compressing} className={btn}>
        {pending || compressing ? "Saving…" : "Mark sent"}
      </button>
      {state?.error && <p role="alert" className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
