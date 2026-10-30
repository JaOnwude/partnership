import { Suspense } from "react";
import { btnGhost, Card, Loading, NoCycle, PageTitle, RoundPicker, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/dal";
import { getActiveCycle, loadCycleData, parseRound, summarise } from "@/lib/cycle-data";
import { naira } from "@/lib/format";
import { formatLagos, formatLagosDay, MONTHS, payoutDay } from "@/lib/time";
import { markPayoutSent, undoPayout } from "../actions";

type SearchParams = PageProps<"/admin/payouts">["searchParams"];

async function Payouts({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const cycle = await getActiveCycle();
  if (!cycle) return <NoCycle isAdmin />;

  const now = new Date();
  const round = parseRound((await searchParams).round, cycle, now);
  const data = await loadCycleData(cycle.id);
  const summary = summarise(cycle, data, round, now);

  return (
    <>
      <PageTitle
        title={`Payouts · ${MONTHS[round - 1]} ${cycle.year}`}
        sub={`Pay recipients on ${formatLagosDay(payoutDay(cycle.year, round))}`}
      />
      <RoundPicker href="/admin/payouts" monthsN={cycle.monthsN} round={round} />

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label="To pay out" value={naira(summary.payoutDue)} />
          <Stat label="Collected" value={naira(summary.collected)} />
          <Stat label="You cover" value={naira(summary.covered)} hint="owed back by members who haven't paid" />
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-semibold text-brand">Recipients</h2>
        <ul className="divide-y divide-brand/10">
          {summary.recipients.map((r) => {
            const sent = data.payouts.get(r.share.id);
            return (
              <li key={r.share.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <div className="min-w-48 flex-1">
                  <p className="font-medium">👑 {data.names.get(r.share.userId)}</p>
                  <p className="text-xs text-foreground/60">
                    {naira(r.share.monthlyAmount)} × {cycle.monthsN} = {naira(r.gross)}
                    {r.ownIncluded ? " · paid own month" : ` · own month netted off (−${naira(r.share.monthlyAmount)})`}
                  </p>
                </div>
                <p className="text-lg font-bold text-brand">{naira(sent?.dueAmount ?? r.net)}</p>
                {sent?.sentAt ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                      Sent {formatLagos(sent.sentAt)}
                    </span>
                    <form action={undoPayout.bind(null, r.share.id)}>
                      <button type="submit" className={btnGhost}>Undo</button>
                    </form>
                  </div>
                ) : (
                  <form action={markPayoutSent.bind(null, r.share.id)}>
                    <button type="submit" className={btnGhost}>Mark sent</button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}

export default function PayoutsPage(props: PageProps<"/admin/payouts">) {
  return (
    <Suspense fallback={<Loading />}>
      <Payouts searchParams={props.searchParams} />
    </Suspense>
  );
}
