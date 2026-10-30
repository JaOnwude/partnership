// Seeds one cycle from a roster file. Usage: npm run seed [-- path/to/roster.json]
// Defaults to seed/roster.local.json (gitignored) if present, else the example.
import { existsSync, readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db";
import { cycles, shares, users } from "../src/db/schema";
import { validateRoster, type Roster } from "../src/lib/roster";

async function main() {
  const url = process.env.DATABASE_URL;
  const pin = process.env.SEED_PIN;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
  if (!pin || !/^\d{6}$/.test(pin)) throw new Error("Set SEED_PIN to a 6-digit dev PIN");

  const file =
    process.argv[2] ??
    (existsSync("seed/roster.local.json") ? "seed/roster.local.json" : "seed/roster.example.json");
  const roster = JSON.parse(readFileSync(file, "utf8")) as Roster;

  const check = validateRoster(roster);
  if (!check.ok || check.monthsN === null) {
    throw new Error(`Roster ${file} is invalid:\n- ${check.errors.join("\n- ")}`);
  }

  const db = createDb(url);
  const [existing] = await db.select().from(cycles).where(eq(cycles.year, roster.year)).limit(1);
  if (existing) {
    console.log(`A cycle for ${roster.year} already exists. Nothing seeded.`);
    return;
  }

  const pinHash = await bcrypt.hash(pin, 10);
  const [cycle] = await db
    .insert(cycles)
    .values({ year: roster.year, slotTarget: roster.slotTarget, monthsN: check.monthsN, status: "active" })
    .returning();

  for (const member of roster.members) {
    const [user] = await db
      .insert(users)
      .values({ name: member.name, phone: member.phone, pinHash, role: member.role ?? "member" })
      .onConflictDoUpdate({ target: users.phone, set: { name: member.name } })
      .returning();
    await db.insert(shares).values(
      member.shares.map((s) => ({
        cycleId: cycle.id,
        userId: user.id,
        monthlyAmount: s.amount,
        payoutMonth: s.month,
      })),
    );
  }

  console.log(
    `Seeded ${roster.year}: ${roster.members.length} members, ${check.monthsN} months, slot ₦${roster.slotTarget.toLocaleString()} (from ${file}).`,
  );
  console.log("Every seeded user has the dev PIN from SEED_PIN. Use this only on a dev database.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
