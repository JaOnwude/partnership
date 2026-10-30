"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { afterFailure, isLocked, minutesLeft } from "@/lib/auth/lockout";
import { createSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/auth/validation";

export type LoginState = { error: string } | undefined;

const WRONG = "Wrong phone number or PIN.";
// Compared against when the phone is unknown, so response time does not reveal it.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-pin", 10);

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    phone: formData.get("phone"),
    pin: formData.get("pin"),
  });
  if (!parsed.success) return { error: "Enter your phone number and 6-digit PIN." };

  const { phone, pin } = parsed.data;
  const db = getDb();
  const now = new Date();
  const [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);

  if (!user || !user.active) {
    await bcrypt.compare(pin, DUMMY_HASH);
    return { error: WRONG };
  }
  if (isLocked(user.lockedUntil, now)) {
    return { error: `Too many attempts. Try again in ${minutesLeft(user.lockedUntil!, now)} minutes.` };
  }

  if (!(await bcrypt.compare(pin, user.pinHash))) {
    const next = afterFailure(user.failedAttempts, now);
    await db.update(users).set(next).where(eq(users.id, user.id));
    return {
      error: next.lockedUntil
        ? "Too many attempts. Try again in 15 minutes."
        : WRONG,
    };
  }

  await db.update(users).set({ failedAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));
  await createSession(user.id);
  redirect("/board");
}
