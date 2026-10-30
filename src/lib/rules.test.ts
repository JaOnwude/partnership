import { describe, expect, it } from "vitest";
import { summariseRound, whatsappList, type PaymentLite, type ShareLite } from "./rules";
import { roundDeadline } from "./time";

// Mirrors seed/roster.example.json: slot target 100k, 4 months.
const shares: ShareLite[] = [
  { id: 1, userId: 1, monthlyAmount: 100_000, payoutMonth: 1 },
  { id: 2, userId: 1, monthlyAmount: 50_000, payoutMonth: 4 },
  { id: 3, userId: 2, monthlyAmount: 50_000, payoutMonth: 2 },
  { id: 4, userId: 3, monthlyAmount: 50_000, payoutMonth: 2 },
  { id: 5, userId: 3, monthlyAmount: 25_000, payoutMonth: 3 },
  { id: 6, userId: 4, monthlyAmount: 25_000, payoutMonth: 3 },
  { id: 7, userId: 4, monthlyAmount: 25_000, payoutMonth: 4 },
  { id: 8, userId: 5, monthlyAmount: 50_000, payoutMonth: 3 },
  { id: 9, userId: 5, monthlyAmount: 25_000, payoutMonth: 4 },
];
const year = 2027;
const deadline = roundDeadline(year, 2); // 7 Mar 2027, 11:59 PM Lagos
const onTime = new Date("2027-03-07T22:50:00Z");
const late = new Date("2027-03-08T09:00:00Z");
const afterDeadline = new Date("2027-03-09T00:00:00Z");

const pay = (id: number, userId: number, amount: number, tellerAt: Date): PaymentLite => ({
  id, userId, round: 2, amount, tellerAt,
});

describe("summariseRound", () => {
  const summary = summariseRound({
    shares,
    payments: [pay(1, 1, 150_000, onTime), pay(2, 3, 75_000, late)],
    waivedUserIds: new Set([5]),
    round: 2,
    monthsN: 4,
    deadline,
    now: afterDeadline,
  });
  const member = (id: number) => summary.members.find((m) => m.userId === id)!;

  it("classifies each member for the round", () => {
    expect(member(1).status).toBe("paid");
    expect(member(2).status).toBe("recipient");
    expect(member(3).status).toBe("late");
    expect(member(4).status).toBe("overdue");
  });

  it("fines ₦5,000 per owed share and honours waivers", () => {
    expect(member(3).fine).toBe(5_000); // one owed share (month 3)
    expect(member(4).fine).toBe(10_000); // two owed shares
    expect(member(5).fine).toBe(10_000);
    expect(member(5).fineWaived).toBe(true);
    expect(summary.finesTotal).toBe(15_000);
  });

  it("nets the recipient's own month unless they paid it", () => {
    const r = (userId: number) => summary.recipients.find((x) => x.share.userId === userId)!;
    expect(r(2).net).toBe(150_000); // 50k × 4 − 50k skipped
    expect(member(3).ownIncluded).toBe(true); // paid 25k owed + 50k own
    expect(r(3).net).toBe(200_000);
  });

  it("reports what the owner must cover", () => {
    expect(summary.expected).toBe(300_000);
    expect(summary.collected).toBe(225_000);
    expect(summary.payoutDue).toBe(350_000);
    expect(summary.covered).toBe(125_000);
  });

  it("balances every round when everyone pays only what they owe", () => {
    for (let round = 1; round <= 4; round++) {
      const payments = [1, 2, 3, 4, 5].map((userId, i) => {
        const owed = shares
          .filter((s) => s.userId === userId && s.payoutMonth !== round)
          .reduce((a, s) => a + s.monthlyAmount, 0);
        return { id: i, userId, round, amount: owed, tellerAt: onTime };
      }).filter((p) => p.amount > 0);
      const s = summariseRound({
        shares, payments, waivedUserIds: new Set(), round, monthsN: 4,
        deadline: roundDeadline(year, round), now: onTime,
      });
      expect(s.collected).toBe(s.payoutDue);
    }
  });

  it("shows unpaid members as due before the deadline", () => {
    const s = summariseRound({
      shares, payments: [], waivedUserIds: new Set(), round: 2, monthsN: 4, deadline, now: onTime,
    });
    expect(s.members.find((m) => m.userId === 4)!.status).toBe("due");
    expect(s.finesTotal).toBe(0);
  });
});

describe("whatsappList", () => {
  it("renders the roster with ticks for paid shares", () => {
    const names = new Map([[1, "Ada"], [2, "Bisi"], [3, "Chidi"], [4, "Dayo"], [5, "Emeka"]]);
    const summary = summariseRound({
      shares, payments: [pay(1, 1, 150_000, onTime)], waivedUserIds: new Set(),
      round: 2, monthsN: 4, deadline, now: onTime,
    });
    const text = whatsappList(shares, names, summary.members, 2);
    expect(text.split("\n\n")).toEqual([
      "1. January   Ada 100k ✅",
      "2. February   Bisi 50k / Chidi 50k",
      "3. March   Chidi 25k / Dayo 25k / Emeka 50k",
      "4. April   Ada 50k ✅ / Dayo 25k / Emeka 25k",
    ]);
  });
});
