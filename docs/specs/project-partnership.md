# Partnership

Type: project (inferred from the description).

## Summary
Partnership is a record-keeping web app (installable as a PWA) for a monthly rotating savings circle run since 2022 by Mrs Victoria Nwokolo, who coordinates from Germany. Members pay into her PalmPay account, post their transfer receipts in a WhatsApp group, and she (or Lolo Onyeze) approves and reposts the full status list by hand. The app replaces that manual loop with a ledger, receipt approval, automatic late flags and a payout checklist. **No money moves through the app.**

## Problem & Goals
- Problem: Each deadline (the 7th) the admin reposts the whole roster with new ✅ marks 4 to 6 times. Receipts get buried in chat, narrations are forgotten, members ask "confirm my contribution", and the owner's exposure for defaults lives in her head.
- Goals:
  - G1. Remove the manual list reposting (one tap produces the WhatsApp-ready list).
  - G2. Every payment has an approved receipt, a teller time and an auditable approver.
  - G3. Late fines are computed automatically and consistently.
  - G4. The owner can see, per month, what is collected, what is owed to recipients, what she is covering and what fines she has earned.
  - G5. Help the owner place members into month slots so each month balances.
- Non-goals: moving or holding money; PalmPay/bank integrations or auto-verifying receipts; WhatsApp bot or API messaging; mid-cycle swaps or exits (barred by the group's terms); partial payments; public signup; multiple circles (v1 serves this one group, but data is keyed by cycle).

## Users & Use Cases
- **Owner/admin (Vicky):** sets up the cycle, places members, approves receipts, runs payouts, sees her float and defaults.
- **Delegate admin (Lolo Onyeze/Ify):** same powers as admin, only when the owner enables her (e.g. absent).
- **Member (about 15 to 20 people):** sees own schedule, amount due and status; uploads a receipt.
- **Proxy:** a member posts a teller on behalf of someone whose phone is down (POS payments); the admin can also record it directly.

Main flows: (1) build the cycle and slots; (2) submit/approve a payment; (3) view and copy the status board; (4) run the 8th payout checklist; (5) review history and the owner's ledger.

## Business rules (confirmed with the user unless marked)
- A **share** is `(member, monthly_amount, payout_month)`. Allowed amounts: 25k, 50k, 100k, 200k, 300k (₦). **A member may hold several shares** in different months (e.g. Mrs Osy holds 100k in June, 100k in July and 200k in August).
- **Slot target** `g` (₦300k this year) is the required sum of monthly amounts of all shares in one payout month. It is fixed within a cycle but may differ between cycles (rarely changes). Cycle length `N = total monthly commitments ÷ g` (10 this year; 12 when enough people). N must be an integer; a roster that does not divide evenly cannot be finalised.
- **Round m:** every share contributes its monthly amount toward month m's pot. Round m is due by **11:59 PM Africa/Lagos on the 7th of the following month** (every round, including the last). Payouts for round m are made on the **8th**.
- **Payout** for a share = `amount × N`, **reduced by its own monthly amount if the holder skipped paying in their own payout month.** Paying in one's own month is allowed and then payout is gross; net cash is identical.
- **No partial payments.** A member's due for a round is the sum of their shares' amounts (excluding own-month shares unless they choose to pay). Bank charges are paid on top and ignored.
- **Late fine:** flat ₦5,000 **per share** per late round, goes to the owner. A payment is late if its **teller transaction time**, confirmed by the admin, is after the deadline. Upload time does not matter.
- The owner pays every recipient in full whether or not everyone paid; the shortfall is a **receivable** from the defaulting member until they pay.
- Roster and slots are fixed after the cycle starts (no swaps, no drop-outs after collecting). Members who leave before collecting are handled manually outside the app.
- The roster is **rebuilt each January**; there is no automatic carry-over.

## Requirements
### Must have
- R1. Roles: owner, delegate admin (owner can enable/disable), member. **Transparency:** all signed-in members can see the full board, every approved payment with its amount and receipt, and payouts (as in the WhatsApp group today). Only owner/admins can approve, edit, waive, and see bank details and audit-log internals.
- R2. Login by phone number + PIN; admins create members and share an invite; 5 failed attempts lock the account for 15 minutes.
- R3. Create a cycle (year, slot target, N derived) with a **placement planner**: assign shares to months, show each month's remaining capacity, and block finalising unless every month sums exactly to `g`.
- R4. Member submits a payment for a round with receipt photo, teller date/time, and optionally "posted on behalf of" a named member; admin can also record a payment directly with the receipt.
- R5. Admin approves or rejects (with reason). Only approved payments count; the admin confirms the teller time.
- R6. Lateness and fines are computed from the confirmed teller time; admin can waive a fine (logged).
- R7. Status board per round: each member ✅/pending/late, pot progress, and a **"Copy WhatsApp list"** button in the group's current format.
- R8. Payout checklist for each round on the 8th: recipient, amount owed (with netting), amount collected, amount the owner is covering, "sent" mark with optional payout receipt.
- R9. Owner ledger: per round and cycle totals for collected, paid out, covered defaults (receivables by member) and fines earned.
- R10. Audit log of every approval, rejection, waiver, edit and role change (who, what, when).
- R11. All money is integer naira; times stored UTC and shown in Africa/Lagos.
### Should have
- R12. Installable PWA that works on low-end Android; receipts compressed client-side to ≤ 500 KB before upload.
- R13. Optional bank details per member (bank, number, name), encrypted at rest, visible only to admins, used on the payout checklist.
- R14. Reminder text generator ("Today is the 7th…") to copy into WhatsApp; deadline countdown on the board.
- R15. Member history view across rounds and the cycle statement for the member.
### Nice to have
- Web push notifications; CSV export; confetti when a pot completes. (Roster is rebuilt each January, so no rollover feature.)

## Proposed Approach
- **Stack:** Next.js (App Router, TypeScript, Tailwind) full-stack with Server Actions/route handlers; Neon Postgres + Drizzle ORM; Vercel Blob for receipts; Vercel Hobby hosting (free; cold start under a second, no 50-minute sleep). Chosen to stay on free tiers with one codebase to deploy.
- **No cron:** lateness, fines and receivables are derived from payments and the deadline at read time, so nothing depends on background jobs (Vercel Hobby cron is daily only).
- **Data model (sketch):**
  - `users(id, name, phone unique, pin_hash, role, active, bank_json_encrypted?)`
  - `cycles(id, year, slot_target, months_n, status)`
  - `shares(id, cycle_id, user_id, monthly_amount, payout_month)`
  - `payments(id, cycle_id, round, payer_user_id, posted_by_user_id, amount, teller_at, submitted_at, receipt_url, status, reviewed_by, reviewed_at, reject_reason)`
  - `fines(id, cycle_id, round, share_id, amount, waived_by?, waived_at?)` (or derived; one per share per late round)
  - `payouts(id, share_id, due_amount, collected_amount, covered_amount, sent_at, sent_by, receipt_url)`
  - `audit_log(id, actor_id, action, entity, entity_id, detail_json, at)`
- **Fixed rule engine:** one pure module computes due amounts, netting, lateness, fines and payout amounts so rules live in one tested place.
- **UI:** pink/purple brand (orchid/magenta direction, blush background) with separate semantic status colours (green paid, amber due soon, red late); exact visual design is decided later.

## Milestones
1. **M0 Foundation:** Next.js app, Neon + Drizzle schema, auth, roles, seed script with this year's roster (names/amounts only). Usable: admin logs in.
2. **M1 Admin ledger (the demo for Vicky and Lolo):** cycle + placement planner, admin-recorded payments, status board, WhatsApp list copy, deadline/fine logic, payout checklist. Members change nothing.
3. **M2 Member portal:** member login, own status, receipt upload, proxy posting, admin approve/reject queue, audit log.
4. **M3 Polish:** PWA install, owner ledger/receivables, delegate toggle, reminders text, history/statements, final UI.
5. **M4 Later:** push notifications, next-cycle rollover, exports.

## Acceptance Criteria
- AC1 (R3): Given shares totalling a month's capacity ≠ `g`, finalising is blocked and the shortfall is shown; when every month equals `g`, N equals total ÷ g and the cycle activates.
- AC2 (R4, R5): A member uploads a receipt; it appears as pending; after admin approval it counts as paid; a rejected one shows the reason and does not count.
- AC3 (R6, R11): A payment with confirmed teller time 11:50 PM on the 7th (uploaded 12:10 AM) is on time; 12:01 AM on the 8th is late and creates a ₦5,000 fine for each share the member owes that round (a member with three shares owes ₦15,000).
- AC4 (rules): A 50k share with N = 10 whose holder skips their own month shows payout ₦450,000; if they paid, payout is ₦500,000.
- AC5 (R8, R9): When a defaulter has not paid by the 8th, the payout checklist shows the full recipient amount, collected amount, and covered amount, and the owner ledger lists that member as a receivable until paid.
- AC6 (R7): "Copy WhatsApp list" outputs the roster by month with ✅ for approved payments, matching the format in the group.
- AC7 (R1): A signed-in member can view any member's approved payments and receipts but cannot approve, edit or waive, and cannot see bank details; the delegate admin cannot act while disabled by the owner.
- AC8 (R2): After 5 wrong PINs the account is locked for 15 minutes.
- AC9 (R10): Every approve, reject, waive, role change and edit has a log entry with actor and time.
- AC10 (R12): Installable on Android Chrome; a 4 MB phone photo uploads as ≤ 500 KB; board loads under 3 seconds on a throttled "Fast 3G" profile.
- AC11 (R3): Seeding with a recorded year of real roster data reproduces the group's published monthly totals.

## Risks & Open Questions
- **Adoption (highest risk):** Vicky and Lolo have not asked for this. Mitigation: M1 is admin-only with zero change for members; ask the three discovery questions before demoing.
- **Trust:** the app cannot verify a receipt is genuine; the admin still checks the PalmPay credit. State this in the UI. Fake-receipt risk stays with the admin.
- **Not a financial service:** it must say it records only and holds no funds. Check what Nigerian data-protection (NDPA) consent wording is needed before real names/bank details are stored.
- **Free-tier limits:** Neon free storage (0.5 GB) and Vercel Hobby are non-commercial; fine for a community tool, revisit if it grows or charges anyone.
- **Privacy:** receipts are visible to every member and may show account names and numbers. Members are told this at signup; admins may redact if needed. Bank details are kept admin-only.
- **Resolved questions (confirmed by the user):** fine is per share; every round is due the 7th of the following month; a member may hold several shares; non-integer N is not allowed; everyone sees everything including receipts and amounts; roster is rebuilt each January; a recipient may pay in their own month; the slot target is fixed within a cycle and rarely changes between cycles.
- **Open questions:** none blocking M0 and M1. Revisit receipt visibility (redaction) after the first real use.
