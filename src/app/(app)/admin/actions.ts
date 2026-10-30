"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { cycles, fineWaivers, payments, payouts, shares, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/dal";
import { loadCycleData, summarise } from "@/lib/cycle-data";
import { normalisePhone } from "@/lib/phone";
import { ALLOWED_AMOUNTS, validateRoster, type Roster } from "@/lib/roster";
import { memberDue } from "@/lib/rules";
import { lagosLocalToUtc } from "@/lib/time";

export type FormState = { error?: string; ok?: string } | undefined;

const id = z.coerce.number().int().positive();

async function getCycle(cycleId: number) {
  const [cycle] = await getDb().select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
  return cycle ?? null;
}

// ---- Payments -------------------------------------------------------------

export async function recordPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      cycleId: id,
      round: id,
      userId: id,
      tellerAt: z.string(),
      includeOwn: z.string().optional(),
      note: z.string().trim().max(200).optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose a member and fill in the teller time." };

  const { cycleId, round, userId, includeOwn, note } = parsed.data;
  const tellerAt = lagosLocalToUtc(parsed.data.tellerAt);
  if (!tellerAt) return { error: "Enter the date and time on the teller." };
  if (tellerAt.getTime() > Date.now() + 5 * 60_000) return { error: "The teller time cannot be in the future." };

  const cycle = await getCycle(cycleId);
  if (!cycle || cycle.status !== "active" || round > cycle.monthsN) return { error: "That round is not open." };

  const db = getDb();
  const cycleShares = await db.select().from(shares).where(eq(shares.cycleId, cycleId));
  const due = memberDue(cycleShares, userId, round);
  // Payments are always in full: the amount is what the member owes, never typed in.
  const amount = due.owed + (includeOwn && due.own > 0 ? due.own : 0);
  if (amount === 0) return { error: "This member owes nothing this round." };

  const [existing] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.cycleId, cycleId),
        eq(payments.round, round),
        eq(payments.payerUserId, userId),
        eq(payments.status, "approved"),
      ),
    )
    .limit(1);
  if (existing) return { error: "A payment is already recorded for this member this round." };

  const [row] = await db
    .insert(payments)
    .values({
      cycleId,
      round,
      payerUserId: userId,
      postedByUserId: admin.id,
      amount,
      tellerAt,
      status: "approved",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      note: note || null,
    })
    .returning({ id: payments.id });
  await audit(admin.id, "payment.record", "payment", row.id, {
    round, userId, amount, tellerAt: tellerAt.toISOString(),
  });
  redirect(`/board?round=${round}`);
}

export async function voidPayment(paymentId: number) {
  const admin = await requireAdmin();
  const [row] = await getDb()
    .update(payments)
    .set({ status: "rejected", rejectReason: "Voided by admin", reviewedBy: admin.id, reviewedAt: new Date() })
    .where(and(eq(payments.id, paymentId), eq(payments.status, "approved")))
    .returning({ id: payments.id, round: payments.round, userId: payments.payerUserId });
  if (row) await audit(admin.id, "payment.void", "payment", row.id, { round: row.round, userId: row.userId });
  refresh();
}

// ---- Fines ----------------------------------------------------------------

export async function waiveFine(cycleId: number, round: number, userId: number) {
  const admin = await requireAdmin();
  await getDb()
    .insert(fineWaivers)
    .values({ cycleId, round, userId, waivedBy: admin.id })
    .onConflictDoNothing();
  await audit(admin.id, "fine.waive", "fine", null, { cycleId, round, userId });
  refresh();
}

export async function unwaiveFine(cycleId: number, round: number, userId: number) {
  const admin = await requireAdmin();
  await getDb()
    .delete(fineWaivers)
    .where(and(eq(fineWaivers.cycleId, cycleId), eq(fineWaivers.round, round), eq(fineWaivers.userId, userId)));
  await audit(admin.id, "fine.unwaive", "fine", null, { cycleId, round, userId });
  refresh();
}

// ---- Payouts --------------------------------------------------------------

export async function markPayoutSent(shareId: number) {
  const admin = await requireAdmin();
  const db = getDb();
  const [share] = await db.select().from(shares).where(eq(shares.id, shareId)).limit(1);
  const cycle = share && (await getCycle(share.cycleId));
  if (!share || !cycle) throw new Error("Share not found");

  const data = await loadCycleData(cycle.id);
  const summary = summarise(cycle, data, share.payoutMonth, new Date());
  const recipient = summary.recipients.find((r) => r.share.id === shareId);
  if (!recipient) throw new Error("Share is not a recipient this round");

  await db
    .insert(payouts)
    .values({ shareId, dueAmount: recipient.net, sentAt: new Date(), sentBy: admin.id })
    .onConflictDoNothing();
  await audit(admin.id, "payout.sent", "share", shareId, { amount: recipient.net });
  refresh();
}

export async function undoPayout(shareId: number) {
  const admin = await requireAdmin();
  await getDb().delete(payouts).where(eq(payouts.shareId, shareId));
  await audit(admin.id, "payout.undo", "share", shareId);
  refresh();
}

// ---- Cycles and placement -------------------------------------------------

export async function createCycle(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      year: z.coerce.number().int().min(2020).max(2100),
      slotTarget: z.coerce.number().int().positive().multipleOf(25_000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a year and a slot target in steps of ₦25,000." };

  const db = getDb();
  const [taken] = await db.select({ id: cycles.id }).from(cycles).where(eq(cycles.year, parsed.data.year));
  if (taken) return { error: `There is already a cycle for ${parsed.data.year}.` };

  const [cycle] = await db
    .insert(cycles)
    .values({ ...parsed.data, monthsN: 0, status: "draft" })
    .returning({ id: cycles.id });
  await audit(admin.id, "cycle.create", "cycle", cycle.id, parsed.data);
  redirect(`/admin/cycles/${cycle.id}`);
}

export async function addShare(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      cycleId: id,
      userId: id,
      amount: z.coerce.number().refine((n) => (ALLOWED_AMOUNTS as readonly number[]).includes(n)),
      month: z.coerce.number().int().min(1).max(12),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose a member, an amount and a month." };

  const { cycleId, userId, amount, month } = parsed.data;
  const cycle = await getCycle(cycleId);
  if (!cycle || cycle.status !== "draft") return { error: "Only a draft cycle can be changed." };

  const db = getDb();
  const monthShares = await db
    .select({ amount: shares.monthlyAmount })
    .from(shares)
    .where(and(eq(shares.cycleId, cycleId), eq(shares.payoutMonth, month)));
  const used = monthShares.reduce((a, s) => a + s.amount, 0);
  if (used + amount > cycle.slotTarget) {
    return { error: `That month only has ₦${(cycle.slotTarget - used).toLocaleString("en-NG")} left.` };
  }

  const [share] = await db
    .insert(shares)
    .values({ cycleId, userId, monthlyAmount: amount, payoutMonth: month })
    .returning({ id: shares.id });
  await audit(admin.id, "share.add", "share", share.id, { cycleId, userId, amount, month });
  refresh();
  return { ok: "Share added." };
}

export async function removeShare(shareId: number) {
  const admin = await requireAdmin();
  const db = getDb();
  const [share] = await db.select().from(shares).where(eq(shares.id, shareId)).limit(1);
  const cycle = share && (await getCycle(share.cycleId));
  if (!share || !cycle || cycle.status !== "draft") throw new Error("Only draft cycles can be changed");
  await db.delete(shares).where(eq(shares.id, shareId));
  await audit(admin.id, "share.remove", "share", shareId, { userId: share.userId, month: share.payoutMonth });
  refresh();
}

export async function finalizeCycle(cycleId: number) {
  const admin = await requireAdmin();
  const cycle = await getCycle(cycleId);
  if (!cycle || cycle.status !== "draft") throw new Error("Only a draft cycle can be finalised");

  const db = getDb();
  const rows = await db.select().from(shares).where(eq(shares.cycleId, cycleId));
  const byUser = new Map<number, Roster["members"][number]>();
  for (const s of rows) {
    const member = byUser.get(s.userId) ?? { name: `#${s.userId}`, phone: String(s.userId), shares: [] };
    member.shares.push({ month: s.payoutMonth, amount: s.monthlyAmount });
    byUser.set(s.userId, member);
  }
  const check = validateRoster({ year: cycle.year, slotTarget: cycle.slotTarget, members: [...byUser.values()] });
  if (!check.ok || check.monthsN === null) throw new Error(check.errors.join("; "));

  await db.update(cycles).set({ monthsN: check.monthsN, status: "active" }).where(eq(cycles.id, cycleId));
  await audit(admin.id, "cycle.finalize", "cycle", cycleId, { monthsN: check.monthsN });
  refresh();
}

// ---- Members --------------------------------------------------------------

export async function addMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(60),
      phone: z.string(),
      pin: z.string().regex(/^\d{6}$/),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a name, a phone number and a 6-digit PIN." };

  const phone = normalisePhone(parsed.data.phone);
  if (!phone) return { error: "That phone number doesn't look right." };

  const db = getDb();
  const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  if (taken) return { error: "Someone already uses that phone number." };

  const [user] = await db
    .insert(users)
    .values({ name: parsed.data.name, phone, pinHash: await bcrypt.hash(parsed.data.pin, 10) })
    .returning({ id: users.id });
  await audit(admin.id, "member.add", "user", user.id, { name: parsed.data.name });
  refresh();
  return { ok: `${parsed.data.name} added. Share their PIN with them privately.` };
}
