"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/dal";
import { sealBankDetails } from "@/lib/crypto";
import type { FormState } from "../admin/actions";

export async function changePin(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!/^\d{6}$/.test(next)) return { error: "The new PIN must be 6 digits." };
  if (next !== formData.get("confirm")) return { error: "The new PINs don't match." };

  const db = getDb();
  const [row] = await db.select({ pinHash: users.pinHash }).from(users).where(eq(users.id, user.id));
  if (!row || !(await bcrypt.compare(current, row.pinHash))) return { error: "Your current PIN is wrong." };

  await db.update(users).set({ pinHash: await bcrypt.hash(next, 10) }).where(eq(users.id, user.id));
  await audit(user.id, "account.pin", "user", user.id);
  return { ok: "PIN changed. Use the new one next time you sign in." };
}

export async function saveBankDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({
      bank: z.string().trim().min(2).max(50),
      number: z.string().trim().regex(/^\d{10}$/),
      name: z.string().trim().min(2).max(80),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter the bank name, the 10-digit account number and the account name." };

  await getDb().update(users).set({ bankDetails: sealBankDetails(parsed.data) }).where(eq(users.id, user.id));
  // The details themselves are never written to the audit log.
  await audit(user.id, "account.bank", "user", user.id);
  refresh();
  return { ok: "Saved. Only the admins can see these details." };
}
