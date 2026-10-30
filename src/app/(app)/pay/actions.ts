"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/dal";
import { preparePayment } from "@/lib/payments";
import { naira } from "@/lib/format";
import { notify } from "@/lib/push";
import { saveReceipt } from "@/lib/storage";
import { MONTHS } from "@/lib/time";
import { nameOf } from "@/lib/updates";
import type { FormState } from "../admin/actions";

// A member submits a payment with its teller photo, for themselves or on behalf
// of someone who paid at a POS. It waits for an admin to approve it.
export async function submitPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const payment = await preparePayment(formData);
  if ("error" in payment) return payment;

  const saved = await saveReceipt(formData.get("receipt"), payment.cycleId, payment.round);
  if ("error" in saved) return saved;

  const [row] = await getDb()
    .insert(payments)
    .values({
      cycleId: payment.cycleId,
      round: payment.round,
      payerUserId: payment.userId,
      postedByUserId: user.id,
      amount: payment.amount,
      tellerAt: payment.tellerAt,
      receiptUrl: saved.key,
      note: payment.note,
      status: "pending",
    })
    .returning({ id: payments.id });
  await audit(user.id, "payment.submit", "payment", row.id, {
    round: payment.round, userId: payment.userId, amount: payment.amount,
  });
  const payer = payment.userId === user.id ? user.name : `${await nameOf(payment.userId)} (sent by ${user.name})`;
  after(() =>
    notify(
      { admins: true },
      { title: "New teller to check", body: `${payer} · ${MONTHS[payment.round - 1]} round · ${naira(payment.amount)}`, url: "/admin/approvals" },
    ),
  );
  redirect(`/board?round=${payment.round}&sent=1`);
}
