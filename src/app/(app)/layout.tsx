import { count, eq } from "drizzle-orm";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getDb } from "@/db";
import { payments } from "@/db/schema";
import { requireUser } from "@/lib/auth/dal";
import { NavMenu, type NavLink } from "@/components/nav-menu";
import { canAdminister } from "@/lib/auth/roles";
import { logout } from "./actions";

async function Nav() {
  const user = await requireUser();
  const links: NavLink[] = [
    { href: "/board", label: "Board" },
    { href: "/updates", label: "Updates" },
    { href: "/pay", label: "Pay" },
    { href: "/history", label: "History" },
  ];
  if (canAdminister(user.role)) {
    const [{ waiting }] = await getDb()
      .select({ waiting: count() })
      .from(payments)
      .where(eq(payments.status, "pending"));
    links.push({ href: "/admin", label: "Admin", count: waiting });
  }

  return <NavMenu links={links} userName={user.name} logout={logout} />;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-30 bg-gradient-to-r from-brand to-accent text-white">
        <div className="relative mx-auto flex h-16 max-w-4xl items-center gap-x-6 px-4">
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
