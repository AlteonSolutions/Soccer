# soccer

A small web app for the kids' soccer team its maintainer coaches: snack sign-up and reminder emails
for parents. Public schedule, no parent accounts; the coach signs in with a Microsoft account.

## Quick start

```
pnpm run setup      # checks Node 22, pnpm, func; installs frozen; writes .env; wires git hooks
pnpm run dev        # Azurite + the site on http://localhost:4280 (admin: /login, pick role "admin")
pnpm run gate       # typecheck every package, lint, format check, tests — run before "done"
```

`pnpm run dev` needs Azure Functions Core Tools (`func`) on PATH; setup prints the install command.
If `pnpm` is missing: `corepack enable && corepack prepare pnpm@10.33.0 --activate`.
Fresh-clone details: `SETUP.md`. Deploying: `docs/runbooks/first-deploy.md`.

## Layout

```
apps/web/               one Azure Static Web App
  client/               the public page and the coach's admin page: HTML, CSS, TypeScript, no framework
  client/logo.svg       the header badge — swap this one file for a logo you are licensed to use
  api/src/routes/       thin HTTP entry points (Azure Functions v4); every route is imported in index.ts
  api/src/lib/          the logic behind them, framework-free, tested directly
  api/src/routes/jobs.ts POST /api/jobs/reminders — the daily job, called by a Logic App with a shared key
  build.mjs             esbuild → dist/client (app_location) and dist/api (api_location)
packages/shared/        @soccer/shared — consumed as source by every app
  src/schemas.ts        every boundary shape, as zod; the public shapes cannot carry an email
  src/config.ts         the only place process.env is read; fails fast naming the variable
  src/data.ts           withData(): the only door to Table Storage; the raw client is not exported
  src/email.ts          ACS email behind EMAIL_LIVE, capture by default
  src/snacks.ts         the sign-up and reminder rules as pure functions
  src/reminders.ts      the daily run: Monday snack reminder, Thursday team reminder
infra/main.bicep        every Azure resource (not yet applied — see its first line)
docs/spec/              what each feature does · docs/runbooks/ how to operate it
scripts/setup.mjs       `pnpm run setup`
```

pnpm workspaces, one lockfile. Node 22 is pinned in `package.json` `engines`, `ci.yml` and
`apps/web/client/staticwebapp.config.json`; they change together.

## Architecture

- **Azure, lowest tier of everything.** Static Web Apps Free hosts the site, its API and the
  coach's sign-in, and gives the custom domain a free certificate. Table Storage holds the data.
  Communication Services sends email from your domain. A Logic App calls the API's reminders
  endpoint once a day, because SWA Free has no timers. Bicep in `infra/` creates all of it.
- **TypeScript, ESM `NodeNext`**, relative imports with `.js` extensions. Every app bundles with
  esbuild into one file, so the platform installs nothing and `workspace:` deps are no problem.
- **Entry points stay thin.** `api/src/routes/` registers functions; `api/src/lib/` does the work
  with a `DataRepo` and a `SendEmail` passed in, so tests use the in-memory repo and captured email.
- **Privacy by type.** `publicGameSchema` has a name, not an email. The admin page is gated by an
  SWA route rule; the admin API by `requireAdmin`, reading the principal header SWA sets.
- **Email never fails the primary action** and never leaves the building until `EMAIL_LIVE=on`.
- **Quality gate.** `pnpm run gate` = typecheck (every package) + ESLint + Prettier + Vitest against
  source, with an Azurite-backed test that skips itself when the emulator is down. The pre-commit
  hook runs the fast half; CI runs all of it on every push, and deploys from `main` only after it.

Rules: `CLAUDE.md`. Why: `DECISIONS.md`. Where things stand: `STATUS.md`.
