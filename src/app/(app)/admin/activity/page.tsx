import { desc } from "drizzle-orm";
import { Suspense } from "react";
import { Card, Loading, PageTitle } from "@/components/ui";
import { getDb } from "@/db";
import { auditLog, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { naira } from "@/lib/format";
import { formatLagos, MONTHS } from "@/lib/time";

const LABELS: Record<string, string> = {
  "payment.record": "recorded a payment",
  "payment.submit": "sent a teller",
  "payment.approve": "approved a payment",
  "payment.reject": "rejected a payment",
  "payment.void": "voided a payment",
  "fine.waive": "waived a fine",
  "fine.unwaive": "restored a fine",
  "payout.sent": "marked a payout sent",
  "payout.undo": "undid a payout",
  "cycle.create": "created a cycle",
  "cycle.finalize": "finalised a cycle",
  "share.add": "placed a share",
  "share.remove": "removed a share",
  "member.add": "added a member",
  "account.bank": "updated their payout account",
  "post.create": "posted an update",
  "post.delete": "deleted an update",
};

type Detail = { round?: number; userId?: number; amount?: number; reason?: string; name?: string; year?: number };

function describe(detail: Detail, names: Map<number, string>) {
  const parts = [
    detail.userId !== undefined && names.get(detail.userId),
    detail.name,
    detail.round !== undefined && `${MONTHS[detail.round - 1]} round`,
    detail.amount !== undefined && naira(detail.amount),
    detail.year,
    detail.reason && `“${detail.reason}”`,
  ];
  return parts.filter(Boolean).join(" · ");
}

async function Activity() {
  await requireAdmin();
  const db = getDb();
  const [rows, people] = await Promise.all([
    db.select().from(auditLog).orderBy(desc(auditLog.at)).limit(100),
    db.select({ id: users.id, name: users.name }).from(users),
  ]);
  const names = new Map(people.map((p) => [p.id, p.name]));
  if (rows.length === 0) return <p className="text-sm">No activity yet.</p>;

  return (
    <ul className="divide-y divide-brand/10">
      {rows.map((r) => (
        <li key={r.id} className="py-3">
          <p className="text-sm">
            <span className="font-medium">{r.actorId ? names.get(r.actorId) : "System"}</span>{" "}
            {LABELS[r.action] ?? r.action}
          </p>
          <p className="text-xs text-foreground/60">
            {formatLagos(r.at)}
            {r.detail ? ` · ${describe(r.detail as Detail, names)}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function ActivityPage() {
  return (
    <>
      <PageTitle title="Activity" sub="Every approval, change and payout, newest first." />
      <Card>
        <Suspense fallback={<Loading />}>
          <Activity />
        </Suspense>
      </Card>
    </>
  );
}
