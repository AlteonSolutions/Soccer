# soccer

A small web app for the kids' soccer team its maintainer coaches: snack sign-up and reminder emails
for parents.

## Quick start

```
pnpm run setup      # checks Node 22 + pnpm, installs frozen, writes .env, wires git hooks
pnpm run dev        # starts every app's dev server (no app exists yet — see STATUS.md)
pnpm run gate       # typecheck every package, lint, format check, tests — run before "done"
```

If `pnpm` is not on your PATH: `corepack enable && corepack prepare pnpm@10.33.0 --activate`.
Fresh-clone details and what each step checks for: `SETUP.md`.

## Layout

```
apps/                 deployable apps (empty until the first one lands)
packages/shared/      @soccer/shared — types, zod schemas, and the config module
  src/config.ts       the only place process.env is read; fails fast naming the variable
  test/               mirrors src/
scripts/setup.mjs     `pnpm run setup`
docs/spec/            what each feature does, written before it is built
docs/runbooks/        how to operate it once deployed
.claude/              house commands (/gate, /ship, /decision, /preflight), hooks, permissions
.githooks/pre-commit  typecheck + lint + format on every commit; tests stay in `gate` and CI
```

pnpm workspaces, one lockfile at the root. Node 22 is pinned in `package.json` `engines`, in
`.github/workflows/ci.yml`, and nowhere else yet; those change together.

## Architecture

- **TypeScript, ESM `NodeNext`** everywhere. Relative imports carry a `.js` extension even in `.ts`.
- **Entry points stay thin.** Each app's `src/routes/` holds handlers that call named functions in
  `lib/`, which import no framework, so tests call them directly.
- **One shared module.** `@soccer/shared` owns every type and zod schema used by more than one
  place. Apps consume its `dist`; Vitest aliases it to source (see `vitest.config.ts`).
- **Configuration is read once**, in `packages/shared/src/config.ts`, validated with zod, with a
  `ConfigError` that names the offending variables and says what to do. ESLint forbids
  `process.env` anywhere else. `.env.example` lists every variable.
- **Quality gate.** `pnpm run gate` = typecheck (every package) + ESLint flat + Prettier check +
  Vitest against source. The pre-commit hook runs the fast half; CI runs all of it on every push.
- **Deploy target: none yet.** When one is chosen it gets a workflow that `needs: test` and a
  dated entry in `DECISIONS.md`.

The rules the code follows are in `CLAUDE.md`; why they were chosen is in `DECISIONS.md`; where
things stand right now is in `STATUS.md`.
