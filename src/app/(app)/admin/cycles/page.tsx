import { desc } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { Card, field, label, Loading, PageTitle } from "@/components/ui";
import { getDb } from "@/db";
import { cycles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/dal";
import { naira } from "@/lib/format";
import { createCycle } from "../actions";

async function CycleList() {
  await requireAdmin();
  const rows = await getDb().select().from(cycles).orderBy(desc(cycles.year));
  if (rows.length === 0) return <p className="text-sm">No cycles yet.</p>;

  return (
    <ul className="divide-y divide-brand/10">
      {rows.map((c) => (
        <li key={c.id}>
          <Link href={`/admin/cycles/${c.id}`} className="flex items-center justify-between py-3 hover:text-accent">
            <span className="font-medium">{c.year}</span>
            <span className="text-sm text-foreground/70">
              {naira(c.slotTarget)} per month · {c.status === "draft" ? "draft" : `${c.monthsN} months · ${c.status}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function CyclesPage() {
  return (
    <>
      <PageTitle title="Cycles" sub="A cycle runs from January. Place everyone, then finalise it to start." />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold text-brand">All cycles</h2>
          <Suspense fallback={<Loading />}>
            <CycleList />
          </Suspense>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold text-brand">New cycle</h2>
          <ActionForm action={createCycle} submitLabel="Create draft">
            <div>
              <label htmlFor="year" className={label}>Year</label>
              <input id="year" name="year" type="number" min={2020} max={2100} required className={field} />
            </div>
            <div>
              <label htmlFor="slotTarget" className={label}>Slot target (₦ per month)</label>
              <input
                id="slotTarget" name="slotTarget" type="number" step={25000} min={25000}
                defaultValue={300000} required className={field}
              />
            </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
