import { eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { CopyButton } from "@/components/copy-button";
import { btn, btnGhost, Card, Loading, NoCycle, PageTitle, RoundPicker, Stat, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth/dal";
import { canAdminister } from "@/lib/auth/roles";
import { getActiveCycle, loadCycleData, parseRound, summarise } from "@/lib/cycle-data";
import { naira } from "@/lib/format";
import { whatsappList } from "@/lib/rules";
import { receiptLink } from "@/lib/storage";
import { formatLagos, formatLagosDay, MONTHS, payoutDay, roundDeadline } from "@/lib/time";
import { VOIDED } from "@/lib/payments";
import { unwaiveFine, voidPayment, waiveFine } from "../admin/actions";

type SearchParams = PageProps<"/board">["searchParams"];

async function Board({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const isAdmin = canAdminister(user.role);
  const cycle = await getActiveCycle();
  if (!cycle) return <NoCycle isAdmin={isAdmin} />;

  const now = new Date();
  const params = await searchParams;
  const round = parseRound(params.round, cycle, now);
  const data = await loadCycleData(cycle.id);
  const summary = summarise(cycle, data, round, now);
  const deadline = roundDeadline(cycle.year, round);
  const passed = now > deadline;

  const pendingBy = new Set(data.pending.filter((p) => p.round === round).map((p) => p.payerUserId));
  // Everyone can see approved receipts, as they could in the WhatsApp group.
  const receipts = new Map(
    await Promise.all(
      data.payments
        .filter((p) => p.round === round && p.receiptUrl)
        .map(async (p) => [p.payerUserId, await receiptLink(p.receiptUrl!)] as const),
    ),
  );

  const rows = summary.members
    .map((m) => ({ ...m, name: data.names.get(m.userId) ?? "?", pending: pendingBy.has(m.userId) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const payoutProofs = new Map(
    await Promise.all(
      summary.recipients
        .map((r) => data.payouts.get(r.share.id))
        .filter((p) => p?.receiptUrl)
        .map(async (p) => [p!.shareId, await receiptLink(p!.receiptUrl!)] as const),
    ),
  );
  const me = rows.find((r) => r.userId === user.id);
  const needsAccount =
    me !== undefined &&
    me.own > 0 &&
    !(await getDb().select({ b: users.bankDetails }).from(users).where(eq(users.id, user.id)))[0]?.b;
  const myRejection =
    me && !me.payment && !me.pending
      ? data.rejected.find((p) => p.round === round && p.payerUserId === user.id && p.rejectReason !== VOIDED)
      : undefined;
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

      {params.sent === "1" && (
        <p className="mb-4 rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800">
          Teller sent. It will show as paid once an admin approves it.
        </p>
      )}

      {me && (
        <Card className="mb-4 border-2 border-accent/30">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-48 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">You this round</p>
              <p className="text-lg font-bold text-brand">
                {me.owed > 0 ? `${naira(me.owed)} due` : "Nothing due"}
                {me.own > 0 && " · you're collecting 👑"}
              </p>
              {me.pending && <p className="text-sm text-amber-800">Your teller is waiting for approval.</p>}
              {myRejection && (
                <p className="text-sm text-red-700">Your last teller was rejected: “{myRejection.rejectReason}”</p>
              )}
              {needsAccount && (
                <p className="text-sm">
                  <Link href="/account" className="font-medium text-accent underline">Add your account details</Link>{" "}
                  so your payout can be sent.
                </p>
              )}
            </div>
            <StatusBadge status={me.status} />
            {!me.payment && !me.pending && me.owed + me.own > 0 && (
              <Link href={`/pay?round=${round}`} className={btn}>Send teller</Link>
            )}
          </div>
        </Card>
      )}

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
                  {receipts.has(m.userId) && (
                    <>
                      {" · "}
                      <a href={receipts.get(m.userId)} target="_blank" rel="noreferrer" className="text-brand underline">
                        receipt
                      </a>
                    </>
                  )}
                </p>
                {m.pending && <p className="text-xs font-medium text-amber-800">⏳ Teller waiting for approval</p>}
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

      {summary.recipients.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-2 font-semibold text-brand">Payouts this round</h2>
          <ul className="divide-y divide-brand/10">
            {summary.recipients.map((r) => {
              const sent = data.payouts.get(r.share.id);
              return (
                <li key={r.share.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                  <span className="flex-1 font-medium">👑 {data.names.get(r.share.userId)}</span>
                  {sent?.sentAt ? (
                    <>
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
                        {naira(sent.dueAmount)} sent {formatLagosDay(sent.sentAt)}
                      </span>
                      {payoutProofs.has(r.share.id) && (
                        <a href={payoutProofs.get(r.share.id)} target="_blank" rel="noreferrer" className="text-brand underline">
                          proof
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="text-foreground/60">Due {formatLagosDay(payoutDay(cycle.year, round))}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

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
