import { Suspense } from "react";
import { Card, Loading, NoCycle, PageTitle, Stat, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { canAdminister } from "@/lib/auth/roles";
import { getActiveCycle, loadCycleData, summarise } from "@/lib/cycle-data";
import { naira } from "@/lib/format";
import { receiptLink } from "@/lib/storage";
import { currentRound, formatLagos, formatLagosDay, MONTHS } from "@/lib/time";

async function History() {
  const user = await requireUser();
  const cycle = await getActiveCycle();
  if (!cycle) return <NoCycle isAdmin={canAdminister(user.role)} />;

  const now = new Date();
  const data = await loadCycleData(cycle.id);
  const current = currentRound(cycle.year, cycle.monthsN, now);
  const rounds = await Promise.all(
    Array.from({ length: cycle.monthsN }, (_, i) => i + 1).map(async (round) => {
      const s = summarise(cycle, data, round, now);
      const me = s.members.find((m) => m.userId === user.id);
      const payout = s.recipients.filter((r) => r.share.userId === user.id);
      const receipt = me?.payment && data.payments.find((p) => p.id === me.payment!.id)?.receiptUrl;
      return { round, me, payout, receipt: receipt ? await receiptLink(receipt) : null, upcoming: round > current };
    }),
  );

  const paid = rounds.reduce((a, r) => a + (r.me?.payment?.amount ?? 0), 0);
  const fines = rounds.reduce((a, r) => a + (r.me && !r.me.fineWaived ? r.me.fine : 0), 0);
  const payouts = rounds.flatMap((r) => r.payout);
  const received = payouts.reduce((a, p) => a + (data.payouts.get(p.share.id)?.dueAmount ?? 0), 0);

  return (
    <>
      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="You've paid" value={naira(paid)} />
          <Stat label="Fines" value={naira(fines)} />
          <Stat label="Your payout" value={payouts.map((p) => MONTHS[p.share.payoutMonth - 1].slice(0, 3)).join(", ") || "—"} hint={payouts.length ? naira(payouts.reduce((a, p) => a + p.net, 0)) : undefined} />
          <Stat label="Received" value={naira(received)} />
        </div>
      </Card>
      <Card>
        <ul className="divide-y divide-brand/10">
          {rounds.map(({ round, me, payout, receipt, upcoming }) => (
            <li key={round} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <div className="min-w-48 flex-1">
                <p className="font-medium">{MONTHS[round - 1]} {payout.length > 0 && "👑"}</p>
                <p className="text-xs text-foreground/60">
                  {me?.owed ? `${naira(me.owed)} due` : "Nothing due"}
                  {me?.payment && ` · paid ${formatLagos(me.payment.tellerAt)}`}
                  {receipt && (
                    <>
                      {" · "}
                      <a href={receipt} target="_blank" rel="noreferrer" className="text-brand underline">receipt</a>
                    </>
                  )}
                </p>
                {me && me.fine > 0 && (
                  <p className={`text-xs ${me.fineWaived ? "text-foreground/50 line-through" : "text-red-700"}`}>Fine {naira(me.fine)}</p>
                )}
                {payout.map((p) => {
                  const sent = data.payouts.get(p.share.id);
                  return (
                    <p key={p.share.id} className="text-xs font-medium text-accent">
                      Your payout {naira(sent?.dueAmount ?? p.net)} · {sent?.sentAt ? `sent ${formatLagosDay(sent.sentAt)}` : "not sent yet"}
                    </p>
                  );
                })}
              </div>
              {me && !upcoming ? <StatusBadge status={me.status} /> : <span className="text-xs text-foreground/50">Upcoming</span>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

export default function HistoryPage() {
  return (
    <>
      <PageTitle title="Your history" sub="Every month of this cycle: what you paid, any fines, and your payout." />
      <Suspense fallback={<Loading />}>
        <History />
      </Suspense>
    </>
  );
}
