import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { cycles, payments, shares } from "@/db/schema";
import { memberDue } from "./rules";
import { lagosLocalToUtc } from "./time";

// Reject reason used when an admin undoes a payment they recorded (not a member's rejected teller).
export const VOIDED = "Voided by admin";

const id = z.coerce.number().int().positive();
const paymentForm = z.object({
  cycleId: id,
  round: id,
  userId: id,
  tellerAt: z.string(),
  includeOwn: z.string().optional(),
  note: z.string().trim().max(200).optional(),
});

export type PreparedPayment = {
  cycleId: number;
  round: number;
  userId: number;
  amount: number;
  tellerAt: Date;
  note: string | null;
};

// Validates a payment form shared by admin recording and member submission.
// The amount is always computed from the member's shares: payments are in full.
export async function preparePayment(formData: FormData): Promise<PreparedPayment | { error: string }> {
  const parsed = paymentForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Choose a member and fill in the teller time." };

  const { cycleId, round, userId, includeOwn, note } = parsed.data;
  const tellerAt = lagosLocalToUtc(parsed.data.tellerAt);
  if (!tellerAt) return { error: "Enter the date and time on the teller." };
  if (tellerAt.getTime() > Date.now() + 5 * 60_000) return { error: "The teller time cannot be in the future." };

  const db = getDb();
  const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
  if (!cycle || cycle.status !== "active" || round > cycle.monthsN) return { error: "That round is not open." };

  const cycleShares = await db.select().from(shares).where(eq(shares.cycleId, cycleId));
  const due = memberDue(cycleShares, userId, round);
  const amount = due.owed + (includeOwn && due.own > 0 ? due.own : 0);
  if (amount === 0) return { error: "This member owes nothing this round." };

  const [existing] = await db
    .select({ status: payments.status })
    .from(payments)
    .where(
      and(
        eq(payments.cycleId, cycleId),
        eq(payments.round, round),
        eq(payments.payerUserId, userId),
        inArray(payments.status, ["approved", "pending"]),
      ),
    )
    .limit(1);
  if (existing?.status === "approved") return { error: "This member's payment for this round is already approved." };
  if (existing?.status === "pending") return { error: "A payment for this member is already waiting for approval." };

  return { cycleId, round, userId, amount, tellerAt, note: note || null };
}
