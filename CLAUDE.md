# Cape 001

Appointment booking platform for barber shops and salons in Kerala, India.
Customers book through the website (`apps/web`); barbers and shop owners manage
bookings through the mobile app (`apps/partner`). Both share one Supabase database.

## Permanent rules

These rules are non-negotiable. If a task seems to require breaking one, stop and ask.

1. **All database changes must be SQL migrations in `supabase/migrations`.** Never change the schema any other way — no Studio/dashboard edits, no ad-hoc SQL against a database, no `db push` of unreviewed changes.
2. **Every new table must have RLS enabled with explicit policies in the same migration.** The `00_rls_guard` test fails if any `public` table lacks RLS or policies.
3. **Never use the Supabase `service_role` key in `apps/web` or `apps/partner`.** Both apps use only the anon key; access is enforced by RLS and database functions.
4. **Bookings are created only through the `book_appointment` database function, never by direct insert.** Clients call it via `supabase.rpc('book_appointment', …)`; the bookings table must not grant insert to `anon`/`authenticated`.
5. **All timestamps are `timestamptz` stored in UTC and displayed in `Asia/Kolkata`.** Never use `timestamp` (without time zone). Format for display with the helpers in `@cape001/core` (`formatInAppTimeZone`, `APP_TIME_ZONE`).
6. **Shared types come from `packages/db` and shared validation from `packages/core`.** Do not hand-write database row types or duplicate Zod schemas inside an app.
7. **After any schema change, regenerate types and run database tests:** `pnpm db:types` then `pnpm db:test`.

## Repository layout

```
apps/web          Next.js 15 (App Router), TypeScript, Tailwind v4, shadcn/ui   @cape001/web
apps/partner      Expo (React Native), TypeScript, expo-router                  @cape001/partner
packages/db       Generated Supabase types (src/database.types.ts — never edit)  @cape001/db
packages/core     Shared Zod schemas and utilities                               @cape001/core
supabase/         Supabase CLI project: config.toml, migrations/, tests/database/
```

Shared packages export TypeScript source directly (no build step). `apps/web` compiles
them via `transpilePackages` in `next.config.ts`; Metro handles them for `apps/partner`.

`apps/partner/AGENTS.md` has Expo-specific guidance — read it before working on the mobile app
(notably: add packages with `npx expo install`, and check the docs for the installed SDK version).
The root `AGENTS.md` is maintained by Turborepo — read the bundled turbo docs it points to before
changing `turbo.json`.

## Commands (run from the repo root)

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install all workspaces |
| `pnpm dev:web` / `pnpm dev:partner` | Run one app |
| `pnpm build` / `pnpm lint` / `pnpm typecheck` | Run across the monorepo via Turborepo |
| `pnpm db:start` / `pnpm db:stop` | Start/stop local Supabase (requires Docker) |
| `pnpm db:new <name>` | Create a new migration file |
| `pnpm db:reset` | Rebuild the local database from migrations |
| `pnpm db:types` | Regenerate `packages/db/src/database.types.ts` from the local database |
| `pnpm db:test` | Run pgTAP tests in `supabase/tests/database` |
| `pnpm test` | Run unit tests (Vitest, currently `packages/core`) via Turborepo |
| `pnpm test:functions` | Run Edge Function unit tests (`supabase/functions/*/*.test.ts`, Node test runner) |

Local phone login: `+91 99999 99999` or `+91 99999 99998` with code `123456` (`[auth.sms.test_otp]`
in `supabase/config.toml`; no SMS is sent). Auth config changes need `pnpm db:stop && pnpm db:start`.

Schema change workflow: `pnpm db:new <name>` → write SQL (table + RLS + policies together) →
`pnpm db:reset` → `pnpm db:types` → `pnpm db:test` → `pnpm typecheck`.

## Environment

See `.env.example` (root) and the per-app `.env.example` files. Never commit real `.env` files.
Web uses `NEXT_PUBLIC_*` variables; partner uses `EXPO_PUBLIC_*` variables.

## Conventions

- Package manager is pnpm only. Add web deps with `pnpm --filter @cape001/web add <pkg>`;
  add partner deps with `npx expo install <pkg>` from `apps/partner`.
- Add shadcn components from `apps/web` with `pnpm dlx shadcn@latest add <component>`.
