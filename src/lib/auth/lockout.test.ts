import { describe, expect, it } from "vitest";
import { afterFailure, isLocked, minutesLeft } from "./lockout";

const now = new Date("2026-01-07T12:00:00Z");

describe("lockout", () => {
  it("counts misses without locking until the fifth", () => {
    expect(afterFailure(0, now)).toEqual({ failedAttempts: 1, lockedUntil: null });
    expect(afterFailure(3, now)).toEqual({ failedAttempts: 4, lockedUntil: null });
  });

  it("locks for 15 minutes on the fifth miss and resets the counter", () => {
    const next = afterFailure(4, now);
    expect(next.failedAttempts).toBe(0);
    expect(next.lockedUntil?.toISOString()).toBe("2026-01-07T12:15:00.000Z");
  });

  it("reports lock state and remaining minutes", () => {
    const until = new Date("2026-01-07T12:15:00Z");
    expect(isLocked(until, now)).toBe(true);
    expect(isLocked(until, new Date("2026-01-07T12:15:00Z"))).toBe(false);
    expect(isLocked(null, now)).toBe(false);
    expect(minutesLeft(until, now)).toBe(15);
  });
});
