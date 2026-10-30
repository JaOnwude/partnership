"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export type NavLink = { href: string; label: string; count?: number };

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Badge({ count }: { count?: number }) {
  if (!count) return null;
  return <span className="ml-1.5 rounded-full bg-white px-1.5 py-0.5 text-xs font-bold text-accent">{count}</span>;
}

// Inline links from tablet width up; a menu button on phones.
export function NavMenu({
  links,
  userName,
  logout,
}: {
  links: NavLink[];
  userName: string;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  // The menu remembers the page it was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (next: boolean) => setOpenOn(next ? pathname : null);
  const waiting = links.reduce((a, l) => a + (l.count ?? 0), 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <nav aria-label="Main" className="hidden flex-1 items-center gap-x-5 text-sm md:flex">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(pathname, l.href) ? "page" : undefined}
            className={`font-medium hover:text-white ${isActive(pathname, l.href) ? "text-white underline underline-offset-4" : "text-white/85"}`}
          >
            {l.label}
            <Badge count={l.count} />
          </Link>
        ))}
        <Link href="/account" title="Your account" className="ml-auto text-white/85 underline-offset-2 hover:underline">
          {userName}
        </Link>
        <form action={logout}>
          <button type="submit" className="rounded-lg bg-white/15 px-3 py-1 font-medium hover:bg-white/25">
            Sign out
          </button>
        </form>
      </nav>

      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="relative ml-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xl hover:bg-white/25 md:hidden"
      >
        <span aria-hidden>{open ? "✕" : "☰"}</span>
        {!open && waiting > 0 && (
          <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-brand bg-white" aria-hidden />
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-16 z-10 bg-foreground/30 md:hidden"
          />
          <nav
            id="mobile-menu"
            aria-label="Main"
            className="absolute inset-x-0 top-full z-20 border-t border-white/15 bg-gradient-to-b from-brand to-[#7a2f8f] px-4 pb-4 shadow-xl md:hidden"
          >
            <ul className="divide-y divide-white/10">
              {[...links, { href: "/account", label: `Your account · ${userName}` }].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    aria-current={isActive(pathname, l.href) ? "page" : undefined}
                    className={`flex items-center py-3.5 text-base font-medium ${isActive(pathname, l.href) ? "text-white" : "text-white/85"}`}
                  >
                    {isActive(pathname, l.href) && <span className="mr-2 h-2 w-2 rounded-full bg-accent" aria-hidden />}
                    {l.label}
                    <Badge count={"count" in l ? l.count : undefined} />
                  </Link>
                </li>
              ))}
            </ul>
            <form action={logout} className="mt-2">
              <button type="submit" className="w-full rounded-xl bg-white/15 py-3 font-semibold hover:bg-white/25">
                Sign out
              </button>
            </form>
          </nav>
        </>
      )}
    </>
  );
}
