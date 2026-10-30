import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { btn, btnGhost, Card, field, label, Loading, PageTitle } from "@/components/ui";
import { getDb } from "@/db";
import { cycles, shares, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { naira, shortAmount } from "@/lib/format";
import { ALLOWED_AMOUNTS } from "@/lib/roster";
import { MONTHS } from "@/lib/time";
import { addShare, finalizeCycle, removeShare } from "../../actions";

async function Planner({ params }: { params: PageProps<"/admin/cycles/[id]">["params"] }) {
  await requireAdmin();
  const cycleId = Number((await params).id);
  if (!Number.isInteger(cycleId)) notFound();

  const db = getDb();
  const [[cycle], cycleShares, people] = await Promise.all([
    db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1),
    db.select().from(shares).where(eq(shares.cycleId, cycleId)).orderBy(shares.id),
    db.select({ id: users.id, name: users.name }).from(users).where(eq(users.active, true)).orderBy(users.name),
  ]);
  if (!cycle) notFound();

  const names = new Map(people.map((p) => [p.id, p.name]));
  const draft = cycle.status === "draft";
  const total = cycleShares.reduce((a, s) => a + s.monthlyAmount, 0);
  const months = MONTHS.map((name, i) => {
    const inMonth = cycleShares.filter((s) => s.payoutMonth === i + 1);
    const used = inMonth.reduce((a, s) => a + s.monthlyAmount, 0);
    return { month: i + 1, name, shares: inMonth, used, left: cycle.slotTarget - used };
  });

  // Ready when the months in use are 1..N with N = total ÷ target and each is exactly full.
  const n = total / cycle.slotTarget;
  const ready =
    Number.isInteger(n) && n >= 1 && months.every((m) => (m.month <= n ? m.left === 0 : m.used === 0));

  return (
    <>
      <PageTitle
        title={`${cycle.year} cycle`}
        sub={
          <>
            {naira(cycle.slotTarget)} per month · {naira(total)} committed monthly
            {Number.isInteger(n) && n > 0 ? ` · ${n} months` : ""} · <strong>{cycle.status}</strong>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
        <Card>
          <ul className="divide-y divide-brand/10">
            {months
              .filter((m) => draft || m.month <= cycle.monthsN)
              .map((m) => (
                <li key={m.month} className="py-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{m.month}. {m.name}</p>
                    <p className={`text-xs font-semibold ${m.left === 0 ? "text-green-700" : "text-foreground/60"}`}>
                      {m.left === 0 ? "Full" : `${naira(m.left)} left`}
                    </p>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {m.shares.map((s) => (
                      <span key={s.id} className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-sm">
                        {names.get(s.userId)} {shortAmount(s.monthlyAmount)}
                        {draft && (
                          <form action={removeShare.bind(null, s.id)}>
                            <button type="submit" aria-label="Remove" className="text-accent hover:text-red-700">×</button>
                          </form>
                        )}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
          </ul>
        </Card>

        {draft && (
          <div className="space-y-4">
            <Card>
              <h2 className="mb-3 font-semibold text-brand">Place a member</h2>
              <ActionForm action={addShare} submitLabel="Add">
                <input type="hidden" name="cycleId" value={cycle.id} />
                <div>
                  <label htmlFor="userId" className={label}>Member</label>
                  <select id="userId" name="userId" required className={field}>
                    {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="amount" className={label}>Monthly amount</label>
                  <select id="amount" name="amount" required className={field}>
                    {ALLOWED_AMOUNTS.map((a) => <option key={a} value={a}>{naira(a)}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="month" className={label}>Payout month</label>
                  <select id="month" name="month" required className={field}>
                    {months.map((m) => (
                      <option key={m.month} value={m.month} disabled={m.left <= 0}>
                        {m.name} ({m.left > 0 ? `${naira(m.left)} left` : "full"})
                      </option>
                    ))}
                  </select>
                </div>
              </ActionForm>
              <Link href="/admin/members" className="mt-3 inline-block text-sm text-brand underline">
                Add a new member first
              </Link>
            </Card>
            <Card>
              <h2 className="mb-2 font-semibold text-brand">Finalise</h2>
              <p className="mb-3 text-sm text-foreground/70">
                {ready
                  ? `Every month is full. Finalising starts a ${n}-month cycle; places can't change afterwards.`
                  : "Fill months from January with no gaps, each to exactly the slot target."}
              </p>
              <form action={finalizeCycle.bind(null, cycle.id)}>
                <button type="submit" disabled={!ready} className={btn}>Finalise cycle</button>
              </form>
            </Card>
          </div>
        )}
      </div>
      {!draft && (
        <Link href="/board" className={`${btnGhost} mt-4`}>Go to the board</Link>
      )}
    </>
  );
}

export default function CyclePage(props: PageProps<"/admin/cycles/[id]">) {
  return (
    <Suspense fallback={<Loading />}>
      <Planner params={props.params} />
    </Suspense>
  );
}
