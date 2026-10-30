import Link from "next/link";
import { Suspense } from "react";
import { CopyButton } from "@/components/copy-button";
import { btnGhost, Card, Loading, NoCycle, PageTitle, RoundPicker, Stat, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { canAdminister } from "@/lib/auth/roles";
import { getActiveCycle, loadCycleData, parseRound, summarise } from "@/lib/cycle-data";
import { naira } from "@/lib/format";
import { whatsappList } from "@/lib/rules";
import { formatLagos, formatLagosDay, MONTHS, payoutDay, roundDeadline } from "@/lib/time";
import { unwaiveFine, voidPayment, waiveFine } from "../admin/actions";

type SearchParams = PageProps<"/board">["searchParams"];

async function Board({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const isAdmin = canAdminister(user.role);
  const cycle = await getActiveCycle();
  if (!cycle) return <NoCycle isAdmin={isAdmin} />;

  const now = new Date();
  const round = parseRound((await searchParams).round, cycle, now);
  const data = await loadCycleData(cycle.id);
  const summary = summarise(cycle, data, round, now);
  const deadline = roundDeadline(cycle.year, round);
  const passed = now > deadline;

  const rows = summary.members
    .map((m) => ({ ...m, name: data.names.get(m.userId) ?? "?" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const owing = rows.filter((r) => r.owed > 0);
  const paid = owing.filter((r) => r.status === "paid" || r.status === "late");
  const progress = summary.expected ? Math.min(100, (summary.collected / summary.expected) * 100) : 0;
  const list = whatsappList(data.shares, data.names, summary.members, round);

  return (
    <>
      <PageTitle
        title={`${MONTHS[round - 1]} ${cycle.year}`}
        sub={
          <>
            Due by {formatLagos(deadline)} · payout {formatLagosDay(payoutDay(cycle.year, round))}
            {passed && <span className="ml-2 font-semibold text-red-700">Deadline passed</span>}
          </>
        }
      />
      <RoundPicker href="/board" monthsN={cycle.monthsN} round={round} />

      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Collected" value={naira(summary.collected)} hint={`of ${naira(summary.expected)}`} />
          <Stat label="Paid" value={`${paid.length} / ${owing.length}`} hint="members" />
          <Stat label="Fines" value={naira(summary.finesTotal)} />
          <Stat label="Payout due" value={naira(summary.payoutDue)} hint={`${summary.recipients.length} recipient(s)`} />
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-brand/10" aria-hidden>
          <div className="h-full rounded-full bg-gradient-to-r from-brand to-accent" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-2 font-semibold text-brand">Members</h2>
        <ul className="divide-y divide-brand/10">
          {rows.map((m) => (
            <li key={m.userId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <div className="min-w-40 flex-1">
                <p className="font-medium">
                  {m.name} {m.own > 0 && <span title="Collecting this round">👑</span>}
                </p>
                <p className="text-xs text-foreground/60">
                  {m.owed > 0 ? `Owes ${naira(m.owed)}` : "Nothing owed"}
                  {m.own > 0 && ` · own month ${naira(m.own)} optional`}
                  {m.payment && ` · teller ${formatLagos(m.payment.tellerAt)}`}
                </p>
                {m.fine > 0 && (
                  <p className={`text-xs font-medium ${m.fineWaived ? "text-foreground/50 line-through" : "text-red-700"}`}>
                    Fine {naira(m.fine)}
                    {m.fineWaived && " (waived)"}
                  </p>
                )}
              </div>
              <StatusBadge status={m.status} />
              {isAdmin && (
                <div className="flex gap-2">
                  {!m.payment && m.owed + m.own > 0 && (
                    <Link href={`/admin/payments/new?round=${round}&member=${m.userId}`} className={btnGhost}>
                      Record
                    </Link>
                  )}
                  {m.payment && (
                    <form action={voidPayment.bind(null, m.payment.id)}>
                      <button type="submit" className={btnGhost}>Void</button>
                    </form>
                  )}
                  {m.fine > 0 && (
                    <form
                      action={(m.fineWaived ? unwaiveFine : waiveFine).bind(null, cycle.id, round, m.userId)}
                    >
                      <button type="submit" className={btnGhost}>
                        {m.fineWaived ? "Undo waive" : "Waive fine"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-brand">WhatsApp list</h2>
          <CopyButton text={list} label="Copy list" />
        </div>
        <pre className="whitespace-pre-wrap rounded-2xl bg-background p-4 font-sans text-sm leading-relaxed">{list}</pre>
      </Card>
    </>
  );
}

export default function BoardPage(props: PageProps<"/board">) {
  return (
    <Suspense fallback={<Loading />}>
      <Board searchParams={props.searchParams} />
    </Suspense>
  );
}
