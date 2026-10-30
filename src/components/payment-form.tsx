"use client";

import { useActionState, useEffect, useState, useTransition, type FormEvent } from "react";
import type { FormState } from "@/app/(app)/admin/actions";
import { btn, field, label } from "@/components/ui";
import { compressImage } from "@/lib/compress-image";
import { naira } from "@/lib/format";

export type PaymentOption = { userId: number; name: string; owed: number; own: number };

export function PaymentForm({
  action,
  cycleId,
  round,
  options,
  defaultUserId,
  defaultTellerAt,
  receiptRequired,
  memberLabel,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cycleId: number;
  round: number;
  options: PaymentOption[];
  defaultUserId?: number;
  defaultTellerAt: string;
  receiptRequired: boolean;
  memberLabel: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [compressing, startTransition] = useTransition();
  const [userId, setUserId] = useState(defaultUserId ?? options[0]?.userId);
  const [includeOwn, setIncludeOwn] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const selected = options.find((o) => o.userId === userId);
  const amount = selected ? selected.owed + (includeOwn ? selected.own : 0) : 0;
  const busy = pending || compressing;

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const photo = formData.get("receipt");
    startTransition(async () => {
      if (photo instanceof File && photo.size > 0) formData.set("receipt", await compressImage(photo));
      startTransition(() => formAction(formData));
    });
  }

  if (options.length === 0) {
    return <p className="text-sm">Everyone who owes this round has paid or is waiting for approval.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="cycleId" value={cycleId} />
      <input type="hidden" name="round" value={round} />
      <div>
        <label htmlFor="userId" className={label}>{memberLabel}</label>
        <select
          id="userId"
          name="userId"
          value={userId}
          onChange={(e) => {
            setUserId(Number(e.target.value));
            setIncludeOwn(false);
          }}
          className={field}
        >
          {options.map((o) => (
            <option key={o.userId} value={o.userId}>{o.name}</option>
          ))}
        </select>
      </div>

      {selected && selected.own > 0 && (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="includeOwn"
            checked={includeOwn}
            onChange={(e) => setIncludeOwn(e.target.checked)}
            className="mt-1 accent-accent"
          />
          <span>Also paid their own month ({naira(selected.own)}). If not, it is taken off their payout.</span>
        </label>
      )}

      <div className="rounded-2xl bg-background p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">Amount (in full)</p>
        <p className="text-2xl font-bold text-brand">{naira(amount)}</p>
      </div>

      <div>
        <label htmlFor="tellerAt" className={label}>Date and time on the teller (Lagos time)</label>
        <input id="tellerAt" name="tellerAt" type="datetime-local" defaultValue={defaultTellerAt} required className={field} />
      </div>

      <div>
        <label htmlFor="receipt" className={label}>
          Teller photo{receiptRequired ? "" : " (optional)"}
        </label>
        <input
          id="receipt"
          name="receipt"
          type="file"
          accept="image/*"
          required={receiptRequired}
          onChange={(e) => {
            const file = e.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
          className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:font-medium file:text-brand"
        />
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={preview} alt="Teller preview" className="mt-2 max-h-48 rounded-xl border border-brand/10" />
        )}
      </div>

      <div>
        <label htmlFor="note" className={label}>Note (optional)</label>
        <input id="note" name="note" maxLength={200} placeholder="e.g. POS payment, teller posted by Rita" className={field} />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <button type="submit" disabled={busy || amount === 0} className={btn}>
        {busy ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
