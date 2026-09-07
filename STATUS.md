# Status

_Written to be read cold. Update it in the same commit as the change it describes._

## 2026-09-07 — Initialised from the Alteon template

**What exists.** The toolchain and house rules, nothing else. pnpm workspaces with one package,
`@soccer/shared`, containing the config module (`src/config.ts`) and its tests. ESLint flat +
Prettier + Vitest + TypeScript wired into `pnpm run gate`, the pre-commit hook, and CI on every push.
`pnpm run setup` takes a fresh clone to a passing gate.

**What does not exist.** Any app. `apps/` is empty, so `pnpm run dev` starts nothing. No data
store, so the data guard named in `CLAUDE.md` (`withData()` in `packages/shared/src/data.ts`) is
not written yet. No deploy target. No email sending.

**Next.** The first app in `apps/` — a web app with two features, in this order:

1. Snack sign-up: parents claim a game date for bringing snacks.
2. Reminder emails: the parent on duty gets a reminder before the game. Sending goes behind a
   capture-vs-send flag defaulting to capture (see `DECISIONS.md`, "Side-effect integrations") and
   may never fail the primary action.

Each feature gets a `docs/spec/<feature>.md` before code.
