export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export function isLocked(lockedUntil: Date | null, now: Date): boolean {
  return lockedUntil !== null && lockedUntil.getTime() > now.getTime();
}

export function minutesLeft(lockedUntil: Date, now: Date): number {
  return Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60_000));
}

// State to store after a wrong PIN. The fifth miss locks the account and
// resets the counter, so the next window starts clean.
export function afterFailure(
  failedAttempts: number,
  now: Date,
): { failedAttempts: number; lockedUntil: Date | null } {
  const attempts = failedAttempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    return { failedAttempts: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000) };
  }
  return { failedAttempts: attempts, lockedUntil: null };
}
