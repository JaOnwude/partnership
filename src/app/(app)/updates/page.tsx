import { desc } from "drizzle-orm";
import { Suspense } from "react";
import { Card, Loading, PageTitle } from "@/components/ui";
import { getDb } from "@/db";
import { posts, users } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { canAdminister } from "@/lib/auth/roles";
import { getActiveCycle } from "@/lib/cycle-data";
import { FINE_PER_SHARE } from "@/lib/rules";
import { naira } from "@/lib/format";
import { receiptLink } from "@/lib/storage";
import { currentRound, formatLagos, MONTHS } from "@/lib/time";
import { deletePost } from "../admin/actions";
import { AnnouncementForm } from "./announcement-form";

const ICON = { announcement: "📣", payment: "✅", pot_complete: "🙌", payout: "💸" } as const;

async function Feed() {
  const user = await requireUser();
  const isAdmin = canAdminister(user.role);
  const db = getDb();
  const [rows, people, cycle] = await Promise.all([
    db.select().from(posts).orderBy(desc(posts.at)).limit(50),
    db.select({ id: users.id, name: users.name }).from(users),
    getActiveCycle(),
  ]);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const attachments = new Map(
    await Promise.all(
      rows.filter((r) => r.attachmentKey).map(async (r) => [r.id, await receiptLink(r.attachmentKey!)] as const),
    ),
  );

  let reminder = "";
  if (cycle) {
    const round = currentRound(cycle.year, cycle.monthsN, new Date());
    reminder =
      `*Today is the 7th of ${MONTHS[round % 12]}, the last day of payment for the ${MONTHS[round - 1]} contributions.*\n\n` +
      `*Any payment after 12 midnight today attracts a ${naira(FINE_PER_SHARE)} fine.*\n\nPlease be informed. Thank you all 🙏`;
  }

  return (
    <>
      {isAdmin && (
        <Card className="mb-4">
          <AnnouncementForm reminder={reminder} />
        </Card>
      )}
      {rows.length === 0 ? (
        <Card><p className="text-sm">No updates yet.</p></Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((p) => (
            <li key={p.id}>
              <Card className={p.kind === "announcement" ? "border-2 border-accent/30" : ""}>
                <div className="flex gap-3">
                  <span className="text-xl" aria-hidden>{ICON[p.kind]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words text-sm">{p.body}</p>
                    {attachments.has(p.id) && (
                      <a href={attachments.get(p.id)} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL */}
                        <img src={attachments.get(p.id)} alt="Transfer receipt" className="mt-2 max-h-56 rounded-xl border border-brand/10" />
                      </a>
                    )}
                    <p className="mt-1 text-xs text-foreground/60">
                      {p.authorId ? names.get(p.authorId) : "Partnership"} · {formatLagos(p.at)}
                    </p>
                  </div>
                  {isAdmin && p.kind === "announcement" && (
                    <form action={deletePost.bind(null, p.id)}>
                      <button type="submit" aria-label="Delete update" className="text-foreground/40 hover:text-red-700">×</button>
                    </form>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default function UpdatesPage() {
  return (
    <>
      <PageTitle title="Updates" sub="Payments received, payouts sent and news from the admins." />
      <Suspense fallback={<Loading />}>
        <Feed />
      </Suspense>
    </>
  );
}
