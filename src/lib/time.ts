// West Africa Time is UTC+1 all year (no daylight saving), so a fixed offset is exact.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const TZ = "Africa/Lagos";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// Round m (January = 1) is due by 11:59 PM Lagos time on the 7th of the following month.
export function roundDeadline(year: number, round: number): Date {
  return new Date(Date.UTC(year, round, 7, 23, 59, 59, 999) - LAGOS_OFFSET_MS);
}

// Recipients of round m are paid on the 8th of the following month.
export function payoutDay(year: number, round: number): Date {
  return new Date(Date.UTC(year, round, 8) - LAGOS_OFFSET_MS);
}

// The round currently collecting: the first one whose deadline has not passed.
export function currentRound(year: number, monthsN: number, now: Date): number {
  for (let r = 1; r <= monthsN; r++) {
    if (now.getTime() <= roundDeadline(year, r).getTime()) return r;
  }
  return monthsN;
}

// Parses a <input type="datetime-local"> value entered in Lagos time.
export function lagosLocalToUtc(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - LAGOS_OFFSET_MS);
}

export function toLagosLocalInput(date: Date): string {
  return new Date(date.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 16);
}

export function formatLagos(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(date);
}

export function formatLagosDay(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric",
  }).format(date);
}
