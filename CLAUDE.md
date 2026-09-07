# soccer

A small web app for the kids' soccer team its maintainer coaches: snack sign-up and reminder emails
for parents.

## Facts

- Node 22 is the only Node major here. It appears in `package.json` `engines`, in CI, and in none
  (no IaC or `.nvmrc` exists yet; add any new runtime pin to this list). Those change in one commit
  or not at all. `.npmrc` sets `engine-strict`, so the wrong major refuses to install.
- Package manager: pnpm 10.33.0, pinned in `packageManager`. Lockfile is committed; CI installs
  frozen. Do not install with another manager.
- Layout: pnpm workspaces — `apps/*` for deployable apps, `packages/*` for shared libraries, one
  lockfile at the root. No app exists in `apps/` yet.
- Shared types and schemas: `packages/shared` (`@soccer/shared`). Import them; never redeclare a
  shape locally. Apps consume its build output (`dist`, via package `exports`); Vitest aliases it
  to source. That split is deliberate — see `vitest.config.ts`.
- Module system: ESM `NodeNext`. Every relative import carries a `.js` extension, even from `.ts`
  source (`./config.js`, never `./config`). Nothing warns until runtime.
- `pnpm run setup` on a fresh clone · `pnpm run dev` to work · `pnpm run gate` before saying
  anything is done.

## Working agreement

- Before running anything that changes state (migration, deploy, bulk script, `git` history), say in
  one plain sentence what it will do. Name a concept the first time it comes up; don't assume it.
- Never report a task complete without running `pnpm run gate` and stating the result. "Should pass"
  is not a result.
- A change that departs from a recorded decision gets a new dated entry in `DECISIONS.md` that
  explicitly supersedes the old one. Never silently contradict a recorded decision.
- Update the affected doc in the **same commit** as the code — never "later". If a doc and reality
  disagree, fix the doc in that commit.
- Any doc describing something not yet true (unapplied IaC, a planned integration) says so in its
  first line.

## Code

- Every non-trivial module opens with a block comment: why it exists and what breaks without it.
  If it exists because something failed once, name the failure.
- Put the reason for a number next to the number — limits, timeouts, page sizes, retry counts.
- `apps/<app>/src/routes/` holds entry points only, and they stay thin. Logic goes in `lib/` as
  exported named functions with no framework import, so tests call them directly without booting a
  server or a DOM.
- A new entry point also needs registering in that app's `src/routes/index.ts`. Skipping it fails
  silently — nothing errors, the route just doesn't exist.
- Never create a second copy of logic. Where a copy is genuinely unavoidable (no build step, another
  runtime), prefix every copied symbol with `_` and name the source file in a comment above the block.
- When two similar things are deliberately *not* unified, say so in a comment at the site, or someone
  will "fix" it.
- All data access goes through `withData()` in `packages/shared/src/data.ts` (not yet written — it
  lands in the same commit as the first data store). The raw client/pool/handle is not exported and
  is never called directly, including in tests and scripts.
- Validate at every boundary with zod (`safeParse`, `.strict()` objects) and reject on failure.
  Payloads from our own UI are not trusted.
- Errors carry a code and remediation text. Raw error to the logs, user-safe message to the UI.
  Never hand the client an error payload it will render as if it were data.
- A secondary side effect — email, notification, webhook, avatar fetch, analytics write — may never
  fail the primary action. Catch it, log it, continue.
- Never present a partial result as if it were complete. Return an explicit `truncated`/`partial`
  flag and surface it in the UI.
- No `TODO`/`FIXME`/`HACK` in committed code. Fix it, or record it as a dated entry in `DECISIONS.md`.
- Naming: kebab-case filenames, `PascalCase.tsx` for components, camelCase functions, PascalCase
  types, snake_case for DB columns and JSON fields.
- UI copy uses Title Case for headings and buttons. Match the existing screens exactly.

## Environment and secrets

- No secret, signed URL, token, or connection string in source. Ever — not "temporarily", not in a
  `.bat` file, not in a test fixture.
- `.env.example` lists **every** variable the code reads, each with a one-line explanation, whether
  it is required or degrades gracefully, and the command to generate it if it is a secret. Add the
  entry in the same commit as the code that reads the var.
- Env is read only in `packages/shared/src/config.ts`, which fails fast with the variable's name on
  a missing required value. No scattered `process.env` reads — ESLint rejects them anywhere else.
- A fresh clone must reach a working dev server with `pnpm run setup` and nothing else. Anything that
  can't be automated (a running container, an account, a file) is checked for by that script, which
  prints what to do. Missing optional integrations degrade — they never crash the app.

## Tests and gates

- `pnpm run gate` runs typecheck for **every** package, lint, format check, and Vitest.
  If a package's typecheck isn't in the gate, it isn't checked until deploy — put it in the gate.
  `pnpm -r run typecheck` silently skips a package that has no `typecheck` script, so every new
  workspace package gets one in the commit that creates it.
- Tests exercise source (`src/*.ts` imported directly; `@soccer/shared` is aliased to its source in
  `vitest.config.ts`); the test script builds first when that is compiled output. Running the test
  file directly after editing source tests the old build.
- Test files mirror the source tree under `test/`. Fixtures are sanitized and committed; real
  customer data is not, in any format.
- The failures worth testing are the quiet ones: a wrong number that still renders, a dropped tab
  that still builds. Test the pure function in `lib/`, not the framework around it.
- CI runs the gate on every push. Every deploy job declares `needs: test`.

## Git and delivery

- Commit subject: imperative, sentence case, no conventional-commit prefix, no ticket id. An
  `Area: ` scope prefix is fine. Body is prose: the problem, the decision, the alternative rejected,
  the consequence. The body is not optional on a non-trivial change.
- Trailers on **every** commit, not most: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
  and `Claude-Session: <url>`.
- Branches are `<kind>/<slug>` off `main`; agent sessions use `claude/<slug>`.
- Never `git reset --hard`, force-push, or `git clean` a tracked tree. Stash, and say that you did.

## Docs

- `README.md` — quick start, layout, architecture · `SETUP.md` — fresh-clone checklist ·
  `DECISIONS.md` — dated, newest first, supersede-don't-contradict · `STATUS.md` — where things
  stand, written to be read cold · `docs/{spec,runbooks}/`.
- The editable source of every generated or shipped asset (PDF, deck, image) lives in `docs/`.
  Generated output alone is a file we will lose.

## Pinned preferences

<!-- Corrections that had to be given twice. Add a dated line each time one is given; never delete
     one without a superseding DECISIONS.md entry. -->

None yet.
