export const ALLOWED_AMOUNTS = [25_000, 50_000, 100_000, 200_000, 300_000] as const;

export type RosterShare = { month: number; amount: number };
export type RosterMember = {
  name: string;
  phone: string;
  role?: "owner" | "admin" | "member";
  shares: RosterShare[];
};
export type Roster = { year: number; slotTarget: number; members: RosterMember[] };

export type RosterCheck = {
  ok: boolean;
  monthsN: number | null;
  monthTotals: number[];
  errors: string[];
};

// A roster is valid when every month's shares add up to exactly the slot
// target and the total monthly commitment divides evenly into whole months.
export function validateRoster(roster: Roster): RosterCheck {
  const errors: string[] = [];
  const shares = roster.members.flatMap((m) =>
    m.shares.map((s) => ({ ...s, member: m.name })),
  );

  for (const s of shares) {
    if (!(ALLOWED_AMOUNTS as readonly number[]).includes(s.amount)) {
      errors.push(`${s.member}: ${s.amount} is not an allowed monthly amount`);
    }
  }

  const total = shares.reduce((sum, s) => sum + s.amount, 0);
  if (roster.slotTarget <= 0 || total % roster.slotTarget !== 0) {
    errors.push(
      `Total monthly commitments (${total}) do not divide evenly by the slot target (${roster.slotTarget})`,
    );
    return { ok: false, monthsN: null, monthTotals: [], errors };
  }

  const monthsN = total / roster.slotTarget;
  const monthTotals = Array<number>(monthsN).fill(0);
  for (const s of shares) {
    if (!Number.isInteger(s.month) || s.month < 1 || s.month > monthsN) {
      errors.push(`${s.member}: month ${s.month} is outside 1 to ${monthsN}`);
      continue;
    }
    monthTotals[s.month - 1] += s.amount;
  }
  monthTotals.forEach((t, i) => {
    if (t !== roster.slotTarget) {
      errors.push(`Month ${i + 1} totals ${t}, expected ${roster.slotTarget}`);
    }
  });

  const phones = roster.members.map((m) => m.phone);
  if (new Set(phones).size !== phones.length) errors.push("Duplicate phone numbers in roster");

  return { ok: errors.length === 0, monthsN, monthTotals, errors };
}
