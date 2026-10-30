import "server-only";
import { and, eq, like } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { cycles, posts, users } from "@/db/schema";
import { loadCycleData, summarise } from "./cycle-data";
import { notify } from "./push";
import { MONTHS } from "./time";

type NewPost = typeof posts.$inferInsert;

export async function postUpdate(values: NewPost) {
  await getDb().insert(posts).values(values);
}

export async function nameOf(userId: number) {
  const [user] = await getDb().select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  return user?.name ?? "A member";
}

// Posted when a payment is approved or recorded, then checks whether the round is now complete.
export async function announcePayment(cycleId: number, round: number, userId: number) {
  await postUpdate({
    cycleId, round, kind: "payment",
    body: `Payment received from ${await nameOf(userId)} for the ${MONTHS[round - 1]} round ✅`,
  });
  after(() =>
    notify(
      { userIds: [userId] },
      { title: "Payment confirmed ✅", body: `Your ${MONTHS[round - 1]} contribution is confirmed.`, url: `/board?round=${round}` },
    ),
  );

  const db = getDb();
  const [cycle] = await db.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
  if (!cycle) return;
  const summary = summarise(cycle, await loadCycleData(cycleId), round, new Date());
  if (summary.expected === 0 || summary.collected < summary.expected) return;

  const [already] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.cycleId, cycleId), eq(posts.round, round), eq(posts.kind, "pot_complete")))
    .limit(1);
  if (!already) {
    const body = `${MONTHS[round - 1]} contributions paid in full 🙌 Thank you all!`;
    await postUpdate({ cycleId, round, kind: "pot_complete", body });
    after(() => notify({ everyone: true }, { title: "Partnership", body, url: "/updates" }));
  }
}

const payoutBody = (name: string) => `Payout sent to ${name}`;

export async function announcePayout(
  cycleId: number, round: number, userId: number, amountText: string, attachmentKey: string | null,
) {
  await postUpdate({
    cycleId, round, kind: "payout", attachmentKey,
    body: `${payoutBody(await nameOf(userId))}: ${amountText} for the ${MONTHS[round - 1]} round 🎉`,
  });
  after(() =>
    notify(
      { userIds: [userId] },
      { title: "Your payout has been sent 🎉", body: `${amountText} for the ${MONTHS[round - 1]} round.`, url: "/updates" },
    ),
  );
}

// When a payout is undone, remove the post that announced it.
export async function retractPayout(cycleId: number, round: number, userId: number) {
  await getDb()
    .delete(posts)
    .where(
      and(
        eq(posts.cycleId, cycleId),
        eq(posts.round, round),
        eq(posts.kind, "payout"),
        like(posts.body, `${payoutBody(await nameOf(userId))}:%`),
      ),
    );
}
