import { asc } from "drizzle-orm";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Card, field, label, Loading, PageTitle } from "@/components/ui";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { addMember } from "../actions";

const ROLE = { owner: "Owner", admin: "Delegate admin", member: "Member" } as const;

async function MemberList() {
  await requireAdmin();
  const rows = await getDb().select().from(users).orderBy(asc(users.name));
  return (
    <ul className="divide-y divide-brand/10">
      {rows.map((u) => (
        <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div>
            <p className="font-medium">{u.name}</p>
            <p className="text-xs text-foreground/60">{u.phone}</p>
          </div>
          <span className="text-xs font-medium text-foreground/70">
            {ROLE[u.role]}
            {u.role === "admin" && (u.delegateEnabled ? " · on" : " · off")}
            {!u.active && " · inactive"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function MembersPage() {
  return (
    <>
      <PageTitle title="Members" />
      <div className="grid gap-4 md:grid-cols-[1fr_18rem]">
        <Card>
          <Suspense fallback={<Loading />}>
            <MemberList />
          </Suspense>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-brand">Add a member</h2>
          <ActionForm action={addMember} submitLabel="Add member">
            <div>
              <label htmlFor="name" className={label}>Name</label>
              <input id="name" name="name" required minLength={2} maxLength={60} className={field} />
            </div>
            <div>
              <label htmlFor="phone" className={label}>Phone number</label>
              <input id="phone" name="phone" type="tel" inputMode="tel" required className={field} />
            </div>
            <div>
              <label htmlFor="pin" className={label}>Starting PIN (6 digits)</label>
              <input
                id="pin" name="pin" inputMode="numeric" pattern="\d{6}" maxLength={6}
                autoComplete="off" required className={field}
              />
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
