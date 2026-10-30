import Link from "next/link";
import type { ReactNode } from "react";
import type { MemberStatus } from "@/lib/rules";
import { MONTHS } from "@/lib/time";

export const btn =
  "inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60";
export const btnGhost =
  "inline-flex items-center justify-center rounded-xl border border-brand/25 px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand/5";
export const field =
  "w-full rounded-xl border border-brand/20 bg-white px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";
export const label = "mb-1 block text-sm font-medium";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl bg-white p-5 shadow-lg shadow-brand/10 ${className}`}>{children}</section>;
}

export function PageTitle({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold text-brand">{title}</h1>
      {sub && <p className="mt-1 text-sm text-foreground/70">{sub}</p>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-2xl bg-background p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground/60">{label}</p>
      <p className="mt-1 text-lg font-bold text-brand">{value}</p>
      {hint && <p className="text-xs text-foreground/60">{hint}</p>}
    </div>
  );
}

const STATUS: Record<MemberStatus, [string, string]> = {
  paid: ["Paid", "bg-green-100 text-green-800"],
  late: ["Paid late", "bg-amber-100 text-amber-800"],
  due: ["Not yet", "bg-brand/10 text-brand"],
  overdue: ["Overdue", "bg-red-100 text-red-700"],
  recipient: ["Collecting", "bg-accent/15 text-accent"],
};

export function StatusBadge({ status }: { status: MemberStatus }) {
  const [text, cls] = STATUS[status];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{text}</span>;
}

export function RoundPicker({ href, monthsN, round }: { href: string; monthsN: number; round: number }) {
  return (
    <nav aria-label="Round" className="mb-4 flex flex-wrap gap-1.5">
      {Array.from({ length: monthsN }, (_, i) => i + 1).map((r) => (
        <Link
          key={r}
          href={`${href}?round=${r}`}
          aria-current={r === round ? "page" : undefined}
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            r === round ? "bg-brand text-white" : "bg-white text-brand hover:bg-brand/10"
          }`}
        >
          {MONTHS[r - 1].slice(0, 3)}
        </Link>
      ))}
    </nav>
  );
}

export function Loading() {
  return <p className="py-10 text-center text-sm text-foreground/60">Loading…</p>;
}

export function NoCycle({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Card>
      <p className="text-sm">There is no active cycle yet.</p>
      {isAdmin && (
        <Link href="/admin/cycles" className={`${btn} mt-4`}>
          Set up a cycle
        </Link>
      )}
    </Card>
  );
}
