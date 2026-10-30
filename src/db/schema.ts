import {
  boolean,
  check,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// All money is stored as whole naira.
export const roleEnum = pgEnum("role", ["owner", "admin", "member"]);
export const cycleStatusEnum = pgEnum("cycle_status", ["draft", "active", "closed"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "approved", "rejected"]);

const id = () => integer().primaryKey().generatedAlwaysAsIdentity();
const at = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  id: id(),
  name: text().notNull(),
  phone: text().notNull().unique(),
  pinHash: text("pin_hash").notNull(),
  role: roleEnum().notNull().default("member"),
  // Owner switches the delegate admin on while she is unavailable.
  delegateEnabled: boolean("delegate_enabled").notNull().default(false),
  active: boolean().notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: at("locked_until"),
  createdAt: at("created_at").notNull().defaultNow(),
});

export const cycles = pgTable("cycles", {
  id: id(),
  year: integer().notNull().unique(),
  slotTarget: integer("slot_target").notNull(),
  monthsN: integer("months_n").notNull(),
  status: cycleStatusEnum().notNull().default("draft"),
  createdAt: at("created_at").notNull().defaultNow(),
});

// A share is one member's monthly amount, paid out in one month of the cycle.
export const shares = pgTable(
  "shares",
  {
    id: id(),
    cycleId: integer("cycle_id").notNull().references(() => cycles.id),
    userId: integer("user_id").notNull().references(() => users.id),
    monthlyAmount: integer("monthly_amount").notNull(),
    payoutMonth: integer("payout_month").notNull(),
  },
  (t) => [check("shares_payout_month_positive", sql`${t.payoutMonth} >= 1`)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    cycleId: integer("cycle_id").notNull().references(() => cycles.id),
    round: integer().notNull(),
    payerUserId: integer("payer_user_id").notNull().references(() => users.id),
    postedByUserId: integer("posted_by_user_id").notNull().references(() => users.id),
    amount: integer().notNull(),
    tellerAt: at("teller_at").notNull(),
    submittedAt: at("submitted_at").notNull().defaultNow(),
    receiptUrl: text("receipt_url").notNull(),
    status: paymentStatusEnum().notNull().default("pending"),
    reviewedBy: integer("reviewed_by").references(() => users.id),
    reviewedAt: at("reviewed_at"),
    rejectReason: text("reject_reason"),
  },
  (t) => [uniqueIndex("payments_one_approved_per_round").on(t.cycleId, t.round, t.payerUserId).where(sql`${t.status} = 'approved'`)],
);

export const payouts = pgTable("payouts", {
  id: id(),
  shareId: integer("share_id").notNull().unique().references(() => shares.id),
  dueAmount: integer("due_amount").notNull(),
  collectedAmount: integer("collected_amount").notNull(),
  coveredAmount: integer("covered_amount").notNull().default(0),
  sentAt: at("sent_at"),
  sentBy: integer("sent_by").references(() => users.id),
  receiptUrl: text("receipt_url"),
});

export const auditLog = pgTable("audit_log", {
  id: id(),
  actorId: integer("actor_id").references(() => users.id),
  action: text().notNull(),
  entity: text().notNull(),
  entityId: text("entity_id"),
  detail: jsonb(),
  at: at("at").notNull().defaultNow(),
});
