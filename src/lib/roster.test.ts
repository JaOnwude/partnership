import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateRoster, type Roster } from "./roster";

const example = JSON.parse(readFileSync("seed/roster.example.json", "utf8")) as Roster;

describe("validateRoster", () => {
  it("accepts the example roster and derives N", () => {
    const check = validateRoster(example);
    expect(check.errors).toEqual([]);
    expect(check.ok).toBe(true);
    expect(check.monthsN).toBe(4);
  });

  it("rejects a month that does not hit the slot target", () => {
    const bad: Roster = structuredClone(example);
    bad.members[0].shares[0].month = 2;
    const check = validateRoster(bad);
    expect(check.ok).toBe(false);
    expect(check.errors.some((e) => e.includes("Month 1"))).toBe(true);
  });

  it("rejects totals that do not divide into whole months", () => {
    const bad: Roster = structuredClone(example);
    bad.slotTarget = 300_000;
    const check = validateRoster(bad);
    expect(check.ok).toBe(false);
    expect(check.monthsN).toBeNull();
  });

  it("rejects amounts outside the allowed set", () => {
    const bad: Roster = structuredClone(example);
    bad.members[0].shares[0].amount = 75_000;
    expect(validateRoster(bad).ok).toBe(false);
  });
});
