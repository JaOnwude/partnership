import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth/dal";
import { canAdminister } from "@/lib/auth/roles";
import { logout } from "./actions";

async function Nav() {
  const user = await requireUser();
  const links = [{ href: "/board", label: "Board" }];
  if (canAdminister(user.role)) {
    links.push(
      { href: "/admin/payouts", label: "Payouts" },
      { href: "/admin/cycles", label: "Cycles" },
      { href: "/admin/members", label: "Members" },
    );
  }

  return (
    <nav className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className="font-medium text-white/90 hover:text-white">
          {l.label}
        </Link>
      ))}
      <span className="ml-auto text-white/80">{user.name}</span>
      <form action={logout}>
        <button type="submit" className="rounded-lg bg-white/15 px-3 py-1 font-medium hover:bg-white/25">
          Sign out
        </button>
      </form>
    </nav>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="bg-gradient-to-r from-brand to-accent text-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/board" className="text-lg font-bold">
            Partnership
          </Link>
          <Suspense fallback={null}>
            <Nav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
