import { asc, eq } from "drizzle-orm";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Card, field, label, Loading, PageTitle } from "@/components/ui";
import { getDb } from "@/db";
import { payments, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { naira } from "@/lib/format";
import { receiptLink } from "@/lib/storage";
import { formatLagos, MONTHS, toLagosLocalInput } from "@/lib/time";
import { approvePayment, rejectPayment } from "../actions";

async function Queue() {
  await requireAdmin();
  const db = getDb();
  const [pending, people] = await Promise.all([
    db.select().from(payments).where(eq(payments.status, "pending")).orderBy(asc(payments.submittedAt)),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
  if (pending.length === 0) return <Card><p className="text-sm">Nothing waiting for approval. 🎉</p></Card>;

  const names = new Map(people.map((p) => [p.id, p.name]));
  const links = await Promise.all(pending.map((p) => (p.receiptUrl ? receiptLink(p.receiptUrl) : null)));

  return (
    <div className="space-y-4">
      {pending.map((p, i) => (
        <Card key={p.id}>
          <div className="flex flex-wrap gap-4">
            {links[i] && (
              <a href={links[i]} target="_blank" rel="noreferrer" className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL */}
                <img src={links[i]} alt={`Teller from ${names.get(p.payerUserId)}`} className="h-40 w-32 rounded-xl border border-brand/10 object-cover" />
              </a>
            )}
            <div className="min-w-56 flex-1 space-y-1">
              <p className="text-lg font-bold text-brand">{names.get(p.payerUserId)} · {naira(p.amount)}</p>
              <p className="text-sm">{MONTHS[p.round - 1]} round</p>
              <p className="text-xs text-foreground/60">
                Teller {formatLagos(p.tellerAt)} · sent {formatLagos(p.submittedAt)}
                {p.postedByUserId !== p.payerUserId && ` by ${names.get(p.postedByUserId)}`}
              </p>
              {p.note && <p className="text-sm italic text-foreground/80">“{p.note}”</p>}
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ActionForm action={approvePayment.bind(null, p.id)} submitLabel="Approve">
              <div>
                <label htmlFor={`tellerAt-${p.id}`} className={label}>Confirm teller time</label>
                <input
                  id={`tellerAt-${p.id}`} name="tellerAt" type="datetime-local" required
                  defaultValue={toLagosLocalInput(p.tellerAt)} className={field}
                />
              </div>
            </ActionForm>
            <ActionForm action={rejectPayment.bind(null, p.id)} submitLabel="Reject">
              <div>
                <label htmlFor={`reason-${p.id}`} className={label}>Reason (shown to the member)</label>
                <input
                  id={`reason-${p.id}`} name="reason" required minLength={3} maxLength={200}
                  placeholder="e.g. amount not received" className={field}
                />
              </div>
            </ActionForm>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <>
      <PageTitle title="Approvals" sub="Check each teller against the PalmPay account before approving." />
      <Suspense fallback={<Loading />}>
        <Queue />
      </Suspense>
    </>
  );
}
