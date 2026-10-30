"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { notify } from "@/lib/push";

const subscription = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function savePushSubscription(input: unknown) {
  const user = await requireUser();
  const sub = subscription.parse(input);
  await getDb()
    .insert(pushSubscriptions)
    .values({ userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
}

export async function removePushSubscription(endpoint: string) {
  const user = await requireUser();
  const [row] = await getDb()
    .select({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
  if (row?.userId === user.id) await getDb().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

export async function sendTestNotification() {
  const user = await requireUser();
  await notify({ userIds: [user.id] }, { title: "Partnership", body: "Notifications are working 🎉", url: "/updates" });
}
