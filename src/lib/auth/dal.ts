import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { canAdminister, effectiveRole } from "./roles";
import { readSessionUserId } from "./session";

// The user is re-read from the database on every request, so deactivating an
// account or switching the delegate off takes effect immediately.
export const getCurrentUser = cache(async () => {
  const id = await readSessionUserId();
  if (id === null) return null;
  const [user] = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, role: effectiveRole(user) };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireOwner() {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/board");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!canAdminister(user.role)) redirect("/board");
  return user;
}
