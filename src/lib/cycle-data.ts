import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { cycles, fineWaivers, payments, payouts, shares, users } from "@/db/schema";
import { summariseRound } from "./rules";
import { currentRound, roundDeadline } from "./time";

export type Cycle = typeof cycles.$inferSelect;

export async function getActiveCycle(): Promise<Cycle | null> {
  const [cycle] = await getDb()
    .select()
    .from(cycles)
    .where(eq(cycles.status, "active"))
    .orderBy(desc(cycles.year))
    .limit(1);
  return cycle ?? null;
}

export async function loadCycleData(cycleId: number) {
  const db = getDb();
  const [people, cycleShares, approved, waivers, sent] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users),
    db
      .select({
        id: shares.id,
        userId: shares.userId,
        monthlyAmount: shares.monthlyAmount,
        payoutMonth: shares.payoutMonth,
      })
      .from(shares)
      .where(eq(shares.cycleId, cycleId))
      .orderBy(shares.payoutMonth, shares.id),
    db
      .select()
      .from(payments)
      .where(and(eq(payments.cycleId, cycleId), eq(payments.status, "approved"))),
    db.select().from(fineWaivers).where(eq(fineWaivers.cycleId, cycleId)),
    db
      .select({ payout: payouts })
      .from(payouts)
      .innerJoin(shares, eq(payouts.shareId, shares.id))
      .where(eq(shares.cycleId, cycleId)),
  ]);
  return {
    names: new Map(people.map((p) => [p.id, p.name])),
    shares: cycleShares,
    payments: approved,
    waivers,
    payouts: new Map(sent.map((r) => [r.payout.shareId, r.payout])),
  };
}

export type CycleData = Awaited<ReturnType<typeof loadCycleData>>;

export function summarise(cycle: Cycle, data: CycleData, round: number, now: Date) {
  return summariseRound({
    shares: data.shares,
    payments: data.payments.map((p) => ({
      id: p.id,
      userId: p.payerUserId,
      round: p.round,
      amount: p.amount,
      tellerAt: p.tellerAt,
    })),
    waivedUserIds: new Set(data.waivers.filter((w) => w.round === round).map((w) => w.userId)),
    round,
    monthsN: cycle.monthsN,
    deadline: roundDeadline(cycle.year, round),
    now,
  });
}

// A valid ?round= value, otherwise the round currently collecting.
export function parseRound(value: unknown, cycle: Cycle, now: Date): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= cycle.monthsN
    ? n
    : currentRound(cycle.year, cycle.monthsN, now);
}
