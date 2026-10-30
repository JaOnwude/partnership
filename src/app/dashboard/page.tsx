import { Suspense } from "react";
import { requireUser } from "@/lib/auth/dal";
import { logout } from "./actions";

const ROLE_LABEL = { owner: "Owner", admin: "Admin", member: "Member" } as const;

// Reading the session is request-time data, so it streams in behind Suspense.
async function Welcome() {
  const user = await requireUser();

  return (
    <>
      <p className="text-sm font-medium text-accent">{ROLE_LABEL[user.role]}</p>
      <h1 className="mt-1 text-2xl font-bold text-brand">Welcome, {user.name}</h1>
      <p className="mt-3 text-sm text-foreground/70">
        You are signed in. The cycle board, payments and payouts arrive in the next milestone.
      </p>
      <form action={logout} className="mt-6">
        <button
          type="submit"
          className="rounded-xl border border-brand/30 px-4 py-2 text-sm font-medium text-brand hover:bg-brand/5"
        >
          Sign out
        </button>
      </form>
    </>
  );
}

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <div className="rounded-3xl bg-white p-6 shadow-xl shadow-brand/10">
        <Suspense fallback={<p className="text-sm text-foreground/60">Loading…</p>}>
          <Welcome />
        </Suspense>
      </div>
    </main>
  );
}
