import { inArray } from "drizzle-orm";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { PayoutSentForm } from "@/components/payout-sent-form";
import { btnGhost, Card, Loading, NoCycle, PageTitle, RoundPicker, Stat } from "@/components/ui";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { openBankDetails } from "@/lib/crypto";
import { getActiveCycle, loadCycleData, parseRound, summarise } from "@/lib/cycle-data";
import { naira } from "@/lib/format";
import { receiptLink } from "@/lib/storage";
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

  const recipientIds = summary.recipients.map((r) => r.share.userId);
  const accounts = recipientIds.length
    ? await getDb().select({ id: users.id, bankDetails: users.bankDetails }).from(users).where(inArray(users.id, recipientIds))
    : [];
  const bank = new Map(accounts.map((a) => [a.id, openBankDetails(a.bankDetails)]));
  const proofs = new Map(
    await Promise.all(
      summary.recipients
        .map((r) => data.payouts.get(r.share.id))
        .filter((p) => p?.receiptUrl)
        .map(async (p) => [p!.shareId, await receiptLink(p!.receiptUrl!)] as const),
    ),
  );

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
            const account = bank.get(r.share.userId);
            return (
              <li key={r.share.id} className="space-y-2 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="min-w-48 flex-1">
                    <p className="font-medium">👑 {data.names.get(r.share.userId)}</p>
                    <p className="text-xs text-foreground/60">
                      {naira(r.share.monthlyAmount)} × {cycle.monthsN} = {naira(r.gross)}
                      {r.ownIncluded ? " · paid own month" : ` · own month netted off (−${naira(r.share.monthlyAmount)})`}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-brand">{naira(sent?.dueAmount ?? r.net)}</p>
                </div>

                {account ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-background px-3 py-2 text-sm">
                    <span>
                      {account.bank} · <strong>{account.number}</strong> · {account.name}
                    </span>
                    <CopyButton text={account.number} label="Copy number" />
                  </div>
                ) : (
                  <p className="text-sm text-amber-800">No account details yet. Ask them to add them under their name in the menu.</p>
                )}

                {sent?.sentAt ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                      Sent {formatLagos(sent.sentAt)}
                    </span>
                    {proofs.has(r.share.id) && (
                      <a href={proofs.get(r.share.id)} target="_blank" rel="noreferrer" className="text-sm text-brand underline">
                        transfer receipt
                      </a>
                    )}
                    <form action={undoPayout.bind(null, r.share.id)}>
                      <button type="submit" className={btnGhost}>Undo</button>
                    </form>
                  </div>
                ) : (
                  <PayoutSentForm action={markPayoutSent.bind(null, r.share.id)} />
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
