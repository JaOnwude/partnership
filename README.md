# Partnership

Record-keeping app for a monthly rotating savings circle. It only records; no money moves through it. See `docs/specs/project-partnership.md` for the full spec.

Stack: Next.js (App Router) + TypeScript + Tailwind, Neon Postgres + Drizzle, deployed on Vercel.

## Setup

1. Create a free project at [neon.tech](https://neon.tech) and copy the pooled connection string.
2. `cp .env.example .env.local` and fill in `DATABASE_URL` and `SESSION_SECRET`.
3. Install and create the tables:

```bash
npm install
npm run db:migrate
npm run seed
npm run dev
```

`npm run seed` reads `seed/roster.local.json` (gitignored, your real roster) or falls back to `seed/roster.example.json`. Every seeded user gets the dev PIN from `SEED_PIN`; use a dev database only.

Sign in at http://localhost:3000 with a seeded phone number (the first one in your roster file is the owner).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run unit tests (roster rules, lockout, roles, phone) |
| `npm run db:generate` | Generate a SQL migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run seed` | Seed a cycle and its members from a roster file |
