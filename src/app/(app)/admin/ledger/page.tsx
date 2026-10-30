import { Suspense } from "react";
import { Card, Loading, NoCycle, PageTitle, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/dal";
import { getActiveCycle, loadCycleData, summarise } from "@/lib/cycle-data";
import { naira } from "@/lib/format";
import { MONTHS, roundDeadline } from "@/lib/time";

async function Ledger() {
  await requireAdmin();
  const cycle = await getActiveCycle();
  if (!cycle) return <NoCycle isAdmin />;

  const now = new Date();
  const data = await loadCycleData(cycle.id);
  const rounds = Array.from({ length: cycle.monthsN }, (_, i) => i + 1).map((round) => {
    const s = summarise(cycle, data, round, now);
    const sent = s.recipients.reduce((a, r) => a + (data.payouts.get(r.share.id)?.dueAmount ?? 0), 0);
    return { round, s, sent, closed: now > roundDeadline(cycle.year, round) };
  });

  // What each member still owes for rounds whose deadline has passed.
  const owed = new Map<number, { contributions: number; months: string[]; fines: number }>();
  for (const { round, s, closed } of rounds) {
    if (!closed) continue;
    for (const m of s.members) {
      const entry = owed.get(m.userId) ?? { contributions: 0, months: [], fines: 0 };
      if (m.status === "overdue") {
        entry.contributions += m.owed;
        entry.months.push(MONTHS[round - 1].slice(0, 3));
      }
      if (!m.fineWaived) entry.fines += m.fine;
      owed.set(m.userId, entry);
    }
  }
  const receivables = [...owed.entries()]
    .filter(([, e]) => e.contributions > 0 || e.fines > 0)
    .map(([userId, e]) => ({ name: data.names.get(userId) ?? "?", ...e }))
    .sort((a, b) => b.contributions + b.fines - (a.contributions + a.fines));

  const total = (pick: (r: (typeof rounds)[number]) => number) => rounds.reduce((a, r) => a + pick(r), 0);
  const outstanding = receivables.reduce((a, r) => a + r.contributions, 0);
  const fines = receivables.reduce((a, r) => a + r.fines, 0);

  return (
    <>
      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Collected" value={naira(total((r) => r.s.collected))} hint={`of ${naira(total((r) => (r.closed ? r.s.expected : 0)))} due so far`} />
          <Stat label="Paid out" value={naira(total((r) => r.sent))} />
          <Stat label="Owed to you" value={naira(outstanding)} hint="unpaid contributions" />
          <Stat label="Fines" value={naira(fines)} hint="incurred, not waived" />
        </div>
      </Card>

      <Card className="mb-4 overflow-x-auto">
        <h2 className="mb-2 font-semibold text-brand">By month</h2>
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-foreground/60">
            <tr>
              <th className="py-2">Month</th>
              <th className="text-right">Expected</th>
              <th className="text-right">Collected</th>
              <th className="text-right">Payout</th>
              <th className="text-right">Sent</th>
              <th className="text-right">Fines</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand/10">
            {rounds.map(({ round, s, sent }) => (
              <tr key={round}>
                <td className="py-2 font-medium">{MONTHS[round - 1]}</td>
                <td className="text-right">{naira(s.expected)}</td>
                <td className={`text-right ${s.collected < s.expected ? "text-amber-800" : ""}`}>{naira(s.collected)}</td>
                <td className="text-right">{naira(s.payoutDue)}</td>
                <td className="text-right">{sent ? naira(sent) : "—"}</td>
                <td className="text-right">{s.finesTotal ? naira(s.finesTotal) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold text-brand">Who owes what</h2>
        <p className="mb-2 text-xs text-foreground/60">
          Unpaid contributions for months past their deadline, and fines. Fine payments aren&apos;t tracked yet, so mark them off by waiving once paid.
        </p>
        {receivables.length === 0 ? (
          <p className="text-sm">Nobody owes anything. 🎉</p>
        ) : (
          <ul className="divide-y divide-brand/10">
            {receivables.map((r) => (
              <li key={r.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="text-foreground/80">
                  {r.contributions > 0 && `${naira(r.contributions)} (${r.months.join(", ")})`}
                  {r.contributions > 0 && r.fines > 0 && " · "}
                  {r.fines > 0 && `fines ${naira(r.fines)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

export default function LedgerPage() {
  return (
    <>
      <PageTitle title="Ledger" sub="The whole cycle at a glance: money in, money out, and what's still owed." />
      <Suspense fallback={<Loading />}>
        <Ledger />
      </Suspense>
    </>
  );
}
