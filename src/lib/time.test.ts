import { describe, expect, it } from "vitest";
import { currentRound, lagosLocalToUtc, payoutDay, roundDeadline, toLagosLocalInput } from "./time";

describe("round dates", () => {
  it("puts the deadline at 11:59 PM Lagos on the 7th of the next month", () => {
    expect(roundDeadline(2026, 10).toISOString()).toBe("2026-11-07T22:59:59.999Z");
    expect(roundDeadline(2026, 12).toISOString()).toBe("2027-01-07T22:59:59.999Z");
  });

  it("puts the payout at the start of the 8th, Lagos time", () => {
    expect(payoutDay(2026, 9).toISOString()).toBe("2026-10-07T23:00:00.000Z");
  });

  it("picks the round still collecting", () => {
    expect(currentRound(2026, 10, new Date("2026-10-30T12:00:00Z"))).toBe(10);
    expect(currentRound(2026, 10, new Date("2026-10-07T22:00:00Z"))).toBe(9);
    expect(currentRound(2026, 10, new Date("2027-03-01T00:00:00Z"))).toBe(10);
  });
});

describe("Lagos local input", () => {
  it("round-trips a datetime-local value", () => {
    const d = lagosLocalToUtc("2026-10-07T23:50");
    expect(d?.toISOString()).toBe("2026-10-07T22:50:00.000Z");
    expect(toLagosLocalInput(d!)).toBe("2026-10-07T23:50");
  });

  it("rejects malformed values", () => {
    expect(lagosLocalToUtc("7/10/2026 11:50pm")).toBeNull();
  });
});
