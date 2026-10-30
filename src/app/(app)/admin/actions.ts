"use server";

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { cycles, fineWaivers, payments, payouts, posts, shares, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/dal";
import { loadCycleData, summarise } from "@/lib/cycle-data";
import { preparePayment, VOIDED } from "@/lib/payments";
import { normalisePhone } from "@/lib/phone";
import { ALLOWED_AMOUNTS, validateRoster, type Roster } from "@/lib/roster";
import { naira } from "@/lib/format";
import { saveReceipt } from "@/lib/storage";
import { lagosLocalToUtc } from "@/lib/time";
import { announcePayment, announcePayout, postUpdate, retractPayout } from "@/lib/updates";

export type FormState = { error?: string; ok?: string } | undefined;

const id = z.coerce.number().int().positive();

async function getCycle(cycleId: number) {
  const [cycle] = await getDb().select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
  return cycle ?? null;
}

// ---- Payments -------------------------------------------------------------

// An admin records a payment directly; it is approved at once. The receipt photo
// is optional because the admin has usually seen the teller on WhatsApp already.
export async function recordPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const payment = await preparePayment(formData);
  if ("error" in payment) return payment;

  let receiptKey: string | null = null;
  const photo = formData.get("receipt");
  if (photo instanceof File && photo.size > 0) {
    const saved = await saveReceipt(photo, payment.cycleId, payment.round);
    if ("error" in saved) return saved;
    receiptKey = saved.key;
  }

  const [row] = await getDb()
    .insert(payments)
    .values({
      cycleId: payment.cycleId,
      round: payment.round,
      payerUserId: payment.userId,
      postedByUserId: admin.id,
      amount: payment.amount,
      tellerAt: payment.tellerAt,
      receiptUrl: receiptKey,
      note: payment.note,
      status: "approved",
      reviewedBy: admin.id,
      reviewedAt: new Date(),
    })
    .returning({ id: payments.id });
  await audit(admin.id, "payment.record", "payment", row.id, {
    round: payment.round, userId: payment.userId, amount: payment.amount,
    tellerAt: payment.tellerAt.toISOString(),
  });
  await announcePayment(payment.cycleId, payment.round, payment.userId);
  redirect(`/board?round=${payment.round}`);
}

// Approves a member-submitted payment. The admin confirms the teller time, which decides lateness.
export async function approvePayment(paymentId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const tellerAt = lagosLocalToUtc(String(formData.get("tellerAt") ?? ""));
  if (!tellerAt) return { error: "Confirm the date and time on the teller." };

  const db = getDb();
  const [pending] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")))
    .limit(1);
  if (!pending) return { error: "This payment was already reviewed." };

  const [approved] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(
      and(
        eq(payments.cycleId, pending.cycleId),
        eq(payments.round, pending.round),
        eq(payments.payerUserId, pending.payerUserId),
        eq(payments.status, "approved"),
      ),
    )
    .limit(1);
  if (approved) return { error: "This member already has an approved payment for this round. Reject this one." };

  await db
    .update(payments)
    .set({ status: "approved", tellerAt, reviewedBy: admin.id, reviewedAt: new Date() })
    .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")));
  await audit(admin.id, "payment.approve", "payment", paymentId, {
    round: pending.round, userId: pending.payerUserId, tellerAt: tellerAt.toISOString(),
  });
  await announcePayment(pending.cycleId, pending.round, pending.payerUserId);
  refresh();
  return { ok: "Approved." };
}

export async function rejectPayment(paymentId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 3 || reason.length > 200) return { error: "Give the member a short reason." };

  const [row] = await getDb()
    .update(payments)
    .set({ status: "rejected", rejectReason: reason, reviewedBy: admin.id, reviewedAt: new Date() })
    .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")))
    .returning({ id: payments.id, round: payments.round, userId: payments.payerUserId });
  if (!row) return { error: "This payment was already reviewed." };
  await audit(admin.id, "payment.reject", "payment", paymentId, { round: row.round, userId: row.userId, reason });
  refresh();
  return { ok: "Rejected." };
}

export async function voidPayment(paymentId: number) {
  const admin = await requireAdmin();
  const [row] = await getDb()
    .update(payments)
    .set({ status: "rejected", rejectReason: VOIDED, reviewedBy: admin.id, reviewedAt: new Date() })
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

// Marks a recipient paid, with an optional photo of the transfer receipt that
// everyone can see on the board and in the updates feed.
export async function markPayoutSent(shareId: number, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const db = getDb();
  const [share] = await db.select().from(shares).where(eq(shares.id, shareId)).limit(1);
  const cycle = share && (await getCycle(share.cycleId));
  if (!share || !cycle) return { error: "Share not found." };

  const data = await loadCycleData(cycle.id);
  const summary = summarise(cycle, data, share.payoutMonth, new Date());
  const recipient = summary.recipients.find((r) => r.share.id === shareId);
  if (!recipient) return { error: "This share is not collecting this round." };
  if (data.payouts.has(shareId)) return { error: "Already marked sent." };

  let proofKey: string | null = null;
  const proof = formData.get("proof");
  if (proof instanceof File && proof.size > 0) {
    const saved = await saveReceipt(proof, cycle.id, share.payoutMonth, "payouts");
    if ("error" in saved) return saved;
    proofKey = saved.key;
  }

  await db
    .insert(payouts)
    .values({ shareId, dueAmount: recipient.net, sentAt: new Date(), sentBy: admin.id, receiptUrl: proofKey })
    .onConflictDoNothing();
  await audit(admin.id, "payout.sent", "share", shareId, { userId: share.userId, amount: recipient.net });
  await announcePayout(cycle.id, share.payoutMonth, share.userId, naira(recipient.net), proofKey);
  refresh();
  return { ok: "Marked sent." };
}

export async function undoPayout(shareId: number) {
  const admin = await requireAdmin();
  const db = getDb();
  const [share] = await db.select().from(shares).where(eq(shares.id, shareId)).limit(1);
  if (!share) return;
  await db.delete(payouts).where(eq(payouts.shareId, shareId));
  await retractPayout(share.cycleId, share.payoutMonth, share.userId);
  await audit(admin.id, "payout.undo", "share", shareId, { userId: share.userId });
  refresh();
}

// ---- Updates feed ---------------------------------------------------------

export async function postAnnouncement(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  if (body.length < 2 || body.length > 2000) return { error: "Write a message first." };
  await postUpdate({ kind: "announcement", authorId: admin.id, body });
  await audit(admin.id, "post.create", "post", null);
  refresh();
  return { ok: "Posted." };
}

export async function deletePost(postId: number) {
  const admin = await requireAdmin();
  await getDb().delete(posts).where(eq(posts.id, postId));
  await audit(admin.id, "post.delete", "post", postId);
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
