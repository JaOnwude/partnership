"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/dal";
import { sealBankDetails } from "@/lib/crypto";
import type { FormState } from "../admin/actions";

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
