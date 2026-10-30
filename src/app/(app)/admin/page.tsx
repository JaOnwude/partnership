import { count, eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Loading, PageTitle } from "@/components/ui";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";

const AREAS = [
  { href: "/admin/approvals", icon: "🧾", title: "Approvals", text: "Check tellers members have sent." },
  { href: "/admin/payouts", icon: "💸", title: "Payouts", text: "Pay this round's recipients on the 8th." },
  { href: "/admin/ledger", icon: "📒", title: "Ledger", text: "Money in, money out, and who owes what." },
  { href: "/admin/cycles", icon: "🗓️", title: "Cycles", text: "Plan next year's months." },
  { href: "/admin/members", icon: "👥", title: "Members", text: "Add members and hand over to your delegate." },
  { href: "/admin/activity", icon: "🕓", title: "Activity", text: "Everything that changed, and who did it." },
];

async function Hub() {
  await requireAdmin();
  const [{ waiting }] = await getDb().select({ waiting: count() }).from(payments).where(eq(payments.status, "pending"));

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {AREAS.map((a) => (
        <Link key={a.href} href={a.href}>
          <Card className="h-full transition hover:shadow-xl hover:shadow-accent/15">
            <p className="text-2xl" aria-hidden>{a.icon}</p>
            <p className="mt-1 font-semibold text-brand">
              {a.title}
              {a.href === "/admin/approvals" && waiting > 0 && (
                <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs text-white">{waiting} waiting</span>
              )}
            </p>
            <p className="text-sm text-foreground/70">{a.text}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

export default function AdminPage() {
  return (
    <>
      <PageTitle title="Admin" />
      <Suspense fallback={<Loading />}>
        <Hub />
      </Suspense>
    </>
  );
}
