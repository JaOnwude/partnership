"use client";

import { useActionState, useState } from "react";
import { btn, field, label } from "@/components/ui";
import { naira } from "@/lib/format";
import { recordPayment } from "../../actions";

type Option = { userId: number; name: string; owed: number; own: number };

export function RecordPaymentForm({
  cycleId,
  round,
  options,
  defaultUserId,
  defaultTellerAt,
}: {
  cycleId: number;
  round: number;
  options: Option[];
  defaultUserId?: number;
  defaultTellerAt: string;
}) {
  const [state, action, pending] = useActionState(recordPayment, undefined);
  const [userId, setUserId] = useState(defaultUserId ?? options[0]?.userId);
  const [includeOwn, setIncludeOwn] = useState(false);
  const selected = options.find((o) => o.userId === userId);
  const amount = selected ? selected.owed + (includeOwn ? selected.own : 0) : 0;

  if (options.length === 0) {
    return <p className="text-sm">Everyone who owes this round has a payment recorded.</p>;
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="cycleId" value={cycleId} />
      <input type="hidden" name="round" value={round} />
      <div>
        <label htmlFor="userId" className={label}>Member</label>
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
          <span>
            Also paid their own month ({naira(selected.own)}). If not, it is taken off their payout.
          </span>
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
        <label htmlFor="note" className={label}>Note (optional)</label>
        <input id="note" name="note" maxLength={200} placeholder="e.g. POS payment, teller posted by Rita" className={field} />
      </div>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <button type="submit" disabled={pending || amount === 0} className={btn}>
        {pending ? "Saving…" : "Record payment"}
      </button>
    </form>
  );
}
