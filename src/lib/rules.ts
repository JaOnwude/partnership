import { shortAmount } from "./format";
import { MONTHS } from "./time";

export const FINE_PER_SHARE = 5_000;

export type ShareLite = { id: number; userId: number; monthlyAmount: number; payoutMonth: number };
// Approved payments only.
export type PaymentLite = { id: number; userId: number; round: number; amount: number; tellerAt: Date };

export type MemberStatus = "paid" | "late" | "due" | "overdue" | "recipient";

export type MemberRound = {
  userId: number;
  owed: number; // must be paid this round, in full
  own: number; // the member's own payout shares this round; paying them is optional
  owedShares: number;
  payment: PaymentLite | null;
  ownIncluded: boolean;
  status: MemberStatus;
  fine: number;
  fineWaived: boolean;
};

export type RecipientPayout = { share: ShareLite; gross: number; net: number; ownIncluded: boolean };

export type RoundSummary = {
  members: MemberRound[];
  recipients: RecipientPayout[];
  expected: number;
  collected: number;
  payoutDue: number;
  covered: number;
  finesTotal: number;
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function memberDue(shares: ShareLite[], userId: number, round: number) {
  const mine = shares.filter((s) => s.userId === userId);
  const owedShares = mine.filter((s) => s.payoutMonth !== round);
  const ownShares = mine.filter((s) => s.payoutMonth === round);
  return {
    owed: sum(owedShares.map((s) => s.monthlyAmount)),
    own: sum(ownShares.map((s) => s.monthlyAmount)),
    owedShares: owedShares.length,
  };
}

export function summariseRound(input: {
  shares: ShareLite[];
  payments: PaymentLite[];
  waivedUserIds: Set<number>;
  round: number;
  monthsN: number;
  deadline: Date;
  now: Date;
}): RoundSummary {
  const { shares, round, monthsN, deadline, now } = input;
  const roundPayments = input.payments.filter((p) => p.round === round);
  const paymentByUser = new Map(roundPayments.map((p) => [p.userId, p]));
  const userIds = [...new Set(shares.map((s) => s.userId))];

  const members = userIds.map((userId): MemberRound => {
    const due = memberDue(shares, userId, round);
    const payment = paymentByUser.get(userId) ?? null;
    const ownIncluded = payment !== null && due.own > 0 && payment.amount >= due.owed + due.own;

    let status: MemberStatus;
    if (payment) status = payment.tellerAt.getTime() <= deadline.getTime() ? "paid" : "late";
    else if (due.owed === 0) status = "recipient";
    else status = now.getTime() <= deadline.getTime() ? "due" : "overdue";

    const fineWaived = input.waivedUserIds.has(userId);
    const fine = status === "late" || status === "overdue" ? FINE_PER_SHARE * due.owedShares : 0;
    return { userId, ...due, payment, ownIncluded, status, fine, fineWaived };
  });

  const byUser = new Map(members.map((m) => [m.userId, m]));
  const recipients = shares
    .filter((s) => s.payoutMonth === round)
    .map((share) => {
      const ownIncluded = byUser.get(share.userId)?.ownIncluded ?? false;
      const gross = share.monthlyAmount * monthsN;
      // A recipient who skips paying in their own month has that contribution netted off.
      return { share, gross, net: ownIncluded ? gross : gross - share.monthlyAmount, ownIncluded };
    });

  const collected = sum(roundPayments.map((p) => p.amount));
  const payoutDue = sum(recipients.map((r) => r.net));
  return {
    members,
    recipients,
    expected: sum(members.map((m) => m.owed)),
    collected,
    payoutDue,
    covered: Math.max(0, payoutDue - collected),
    finesTotal: sum(members.filter((m) => !m.fineWaived).map((m) => m.fine)),
  };
}

// The roster in the group's WhatsApp format, with ✅ against shares paid this round.
export function whatsappList(
  shares: ShareLite[],
  names: Map<number, string>,
  members: MemberRound[],
  round: number,
): string {
  const byUser = new Map(members.map((m) => [m.userId, m]));
  const lastMonth = Math.max(0, ...shares.map((s) => s.payoutMonth));
  const lines: string[] = [];
  for (let month = 1; month <= lastMonth; month++) {
    const parts = shares
      .filter((s) => s.payoutMonth === month)
      .map((s) => {
        const m = byUser.get(s.userId);
        const paid = m !== undefined && (m.status === "paid" || m.status === "late");
        const ticked = paid && (s.payoutMonth !== round || m.ownIncluded);
        return `${names.get(s.userId) ?? "?"} ${shortAmount(s.monthlyAmount)}${ticked ? " ✅" : ""}`;
      });
    lines.push(`${month}. ${MONTHS[month - 1]}   ${parts.join(" / ")}`);
  }
  return lines.join("\n\n");
}
