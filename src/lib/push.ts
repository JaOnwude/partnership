import "server-only";
import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { getDb } from "@/db";
import { pushSubscriptions, users } from "@/db/schema";
import { canAdminister, effectiveRole } from "./auth/roles";

export type PushMessage = { title: string; body: string; url?: string };
export type Audience = { userIds?: number[]; admins?: boolean; everyone?: boolean };

let configured: boolean | undefined;
function configure(): boolean {
  if (configured !== undefined) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  configured = Boolean(publicKey && privateKey);
  if (configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://github.com/JaOnwude/partnership", publicKey!, privateKey!);
  }
  return configured;
}

// Best-effort: a failed notification never breaks the action that sent it.
// Call it inside next/server `after()` so the user doesn't wait for it.
export async function notify(audience: Audience, message: PushMessage) {
  if (!configure()) return;
  try {
    const db = getDb();
    const rows = (
      await db
        .select({ sub: pushSubscriptions, role: users.role, delegateEnabled: users.delegateEnabled })
        .from(pushSubscriptions)
        .innerJoin(users, eq(pushSubscriptions.userId, users.id))
    ).filter(
      (r) =>
        audience.everyone ||
        audience.userIds?.includes(r.sub.userId) ||
        (audience.admins && canAdminister(effectiveRole(r))),
    );

    const payload = JSON.stringify(message);
    const results = await Promise.allSettled(
      rows.map(({ sub }) =>
        webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload),
      ),
    );

    // Subscriptions the push service no longer knows about are removed.
    const gone = rows
      .filter((_, i) => {
        const r = results[i];
        return r.status === "rejected" && [404, 410].includes((r.reason as { statusCode?: number }).statusCode ?? 0);
      })
      .map(({ sub }) => sub.id);
    if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  } catch (err) {
    console.error("Push notification failed", err);
  }
}
