# Decisions

Newest first. A change to a decision **supersedes** it — add a new entry, never edit or delete the
old one. Entry format:

```
### YYYY-MM-DD — <the decision in one imperative line>
**Context.** What forced the choice.
**Decision.** What we are doing.
**Rejected.** What we are not doing, and why.
**Consequence.** What this costs or constrains. Supersedes: <date, or "none">.
```

### 2026-09-12 — Schedule the daily reminder run with a Logic App calling the API, not a Function App
**Context.** The first two Bicep runs failed preflight with `SubscriptionIsOverQuotaForSku`: the
subscription has no Consumption-plan Function App quota in East US and its one slot in East US 2 is
taken. A quota request takes days; the only thing the separate app did was hold a timer.
**Decision.** `runReminders` lives in `packages/shared` and is exposed as `POST /api/jobs/reminders`
in the Static Web App's own API, guarded by a shared `JOB_KEY` compared in constant time. A
Consumption Logic App, created by the same Bicep, calls it daily at 14:00 UTC with three retries.
The key is derived deterministically in Bicep from subscription and resource-group ids so both
sides always agree after a redeploy. Thursday's sends run in parallel to fit the API's 45-second
request limit.
**Rejected.** Flex Consumption (different quota, but a different deployment shape and a bigger
change). A GitHub Actions cron (free, but the schedule would live outside Azure). A quota increase
request (days of waiting for one tiny app).
**Consequence.** One deployable instead of two, one secret in GitHub instead of two, and a
scheduler that costs about a cent a month. `apps/reminders` is gone. Supersedes: 2026-09-07 "Host
on Azure at the lowest tier" (the Function App clause only; everything else stands).

### 2026-09-07 — Merge pull requests with a merge commit; deploy from `main` only
**Context.** The first pull request is ready and the delivery-flow row was still open. Every commit
on the branch carries the prose body the house convention asks for; a squash would replace nine
worked examples with one.
**Decision.** One branch per change, a pull request into `main`, merged with a merge commit so the
branch's commits and their bodies stay in `git log`. CI gates every push; the deploy jobs run only
from `main`, on a push or a manual workflow run, and only while `DEPLOY_ENABLED` is set.
**Rejected.** Squash merging: the recommended default in the audit, but it discards exactly the
history this repo invests in. Rebase merging: rewrites history on a branch someone may have
checked out.
**Consequence.** `git log --first-parent main` reads as one line per pull request; the full log
reads as the reasoning. Supersedes: none.

### 2026-09-07 — Host on Azure at the lowest tier of everything, from the owner's existing accounts
**Context.** The owner has Azure and Microsoft accounts and a domain, wants everything on the
Microsoft side, and wants the smallest possible bill. The app serves one team: a few hits a week.
**Decision.** Azure Static Web Apps **Free** hosts the site, its HTTP API as managed Functions,
the custom domain with a free certificate, and the coach's sign-in (built-in Entra provider, role
`admin`). Azure Table Storage holds the data. Azure Communication Services sends email from the
owner's domain. A Consumption-plan Function App runs the daily timer, because SWA Free is HTTP-only.
Application Insights (free below 5 GB/month) gives both Function hosts logs. `infra/main.bicep`
creates all of it and is authoritative once applied; deploys run from `main` only, after the gate,
and only once the repository variable `DEPLOY_ENABLED` is set.
**Rejected.** App Service Basic (about $13/month idle). SWA Standard (about $9/month) only to get
timer triggers inside one deployable. Cosmos DB free tier and Azure SQL free offer: capable, but
far more machinery than a few hundred rows need. A GitHub Actions cron for reminders: free, but it
puts the schedule outside Azure. Microsoft 365 SMTP from a mailbox: ties the app to a personal
credential, the secret-in-config hazard the house rules exist for.
**Consequence.** Two deployables (SWA, reminders Function App) instead of one; the reminders app
is tiny and shares every module. Expected cost is under a few dollars a month. Supersedes:
2026-09-07 "Defer the deploy target".
_The Function App clause is superseded by 2026-09-12 "Schedule the daily reminder run with a Logic App"._

### 2026-09-07 — No parent accounts; the site is public and a sign-up is a name plus an email that only the coach sees
**Context.** The owner asked for the simplest thing: parents visit a page, sign up for a game with
their email, no login. Emails must be stored privately.
**Decision.** Public schedule, no auth for parents. A sign-up stores `parent_name` and `email` in
the `claims` table. The public API and page show the name; the email is in `claimSchema` and the
admin API only, and `publicGameSchema` is typed so it cannot carry one. Admin routes are gated by
SWA route rules and again by `requireAdmin` in the API. The coach signs in with a Microsoft
account and the `admin` role; there is exactly one privileged user. Single tenant: one team.
**Rejected.** Per-family private links (proposed earlier the same day): more privacy plumbing than
a team snack list needs. Parents releasing their own slot: with no account there is nothing to
prove it is theirs, so release is the coach's job.
**Consequence.** Anyone with the URL can sign up under any name; the coach is the moderator. If
that is ever abused, a per-claim secret link in the confirmation email is the smallest fix.
Supersedes: none.

### 2026-09-07 — Consume `@soccer/shared` as source everywhere; each app bundles itself with esbuild
**Context.** The morning's entry had apps consume `dist` and Vitest alias to source. Building the
first app showed the real constraint: Oryx (the SWA build service) cannot install `workspace:`
dependencies, so the API must be bundled before deploy anyway — and once esbuild bundles, a
`dist` for the shared package has no consumer.
**Decision.** `packages/shared` has no build. Its `exports` point at `.ts` (`.` and `./schemas`);
tsc, Vitest and esbuild all resolve it to source. Each app's `build.mjs` bundles one file per
entry (CJS for the Functions hosts, ESM for the browser) and the deploy uses `skip_api_build`.
`@azure/functions-core` is the one external: the worker provides it at runtime.
**Rejected.** Keeping `dist` plus a Vitest alias: the split-consumption hazard the audit flagged,
for nothing. TS project references: more config to get the same source-of-truth.
**Consequence.** The browser client may only import from `@soccer/shared/schemas` (no Node
imports); its tsconfig has no Node types so the compiler enforces it. Supersedes: 2026-09-07
"Use pnpm workspaces" (the source/dist paragraph only; the layout stands).

### 2026-09-07 — Azurite-backed test for the real data repo, self-skipping
**Context.** The in-memory repo proves the logic, not the storage mapping. The first Azurite run
caught a real bug (Table Storage returns `odata.metadata` on point reads and cannot store null).
**Decision.** `packages/shared/test/data.test.ts` runs against Azurite when port 10002 answers and
skips itself, saying so, when it does not. Azurite is a devDependency; `pnpm run dev:storage`.
**Rejected.** Mocking the SDK: it would have passed the buggy code. Requiring Azurite for the gate:
would fail on a machine that only wants to lint.
**Consequence.** The gate is only fully meaningful with Azurite up; CI does not start it yet, so
run it locally before touching `data.ts`. Supersedes: none.

### 2026-09-07 — Use pnpm workspaces: `apps/*` for apps, `packages/*` for shared code
**Context.** Init interview, question 2. Two of the four audited projects had a two-tree layout with
an install-order gotcha documented only inside a CI comment.
**Decision.** pnpm workspaces declared in `pnpm-workspace.yaml`: `apps/*` (deployable) and
`packages/*` (libraries), one lockfile at the root. `packages/shared` (`@soccer/shared`) holds every
shared type, zod schema and the config module. Apps consume its `dist` via package `exports`; Vitest
aliases it to source (`vitest.config.ts`) so tests never run against a stale build.
**Rejected.** Single package with a root `src/`: cheaper today, but the second app (a mailer, a
job runner) would force a migration. Consuming shared source everywhere: hides the build step until
deploy.
**Consequence.** `apps/` is empty until the first app lands, so `pnpm run dev` starts nothing yet.
The source/dist split must be stated wherever it bites (it is, in `CLAUDE.md` and
`vitest.config.ts`). Supersedes: none.
_The source/dist paragraph is superseded by 2026-09-07 "Consume `@soccer/shared` as source"; the layout stands._

### 2026-09-07 — Pin pnpm 10.33.0 in `packageManager`
**Context.** Init interview, question 3. The only audited project that pinned its manager never had
an install ambiguity.
**Decision.** pnpm, exact version in `package.json` `packageManager`, provided by Corepack. CI and
`pnpm run setup` install with `--frozen-lockfile`. `.claude/settings.json` and the command
frontmatter allow `pnpm …`, not `npm …`.
**Rejected.** npm: no workspace hoisting control and no version pin without Volta or similar.
**Consequence.** `corepack enable && corepack prepare pnpm@10.33.0 --activate` is a fresh-machine
step; setup prints it when pnpm is missing. Bumping pnpm is a one-line change to `packageManager`.
Supersedes: none.

### 2026-09-07 — Node 22, one number, in `engines`, CI and nowhere else
**Context.** Init interview, question 4. A three-way disagreement about the Node version once
produced a deploy that succeeded and then indexed zero functions.
**Decision.** `22` in `package.json` `engines.node` and `.github/workflows/ci.yml`; `.npmrc` sets
`engine-strict` so a wrong major refuses to install. No other runtime pin exists yet; any new one
(Dockerfile, IaC parameter, `.nvmrc`) is added to the list in `CLAUDE.md` and changes in the same
commit.
**Rejected.** A range such as `>=22`: it is what let the disagreement hide.
**Consequence.** Moving to Node 24 is one commit touching every listed file. Supersedes: none.

### 2026-09-07 — ESM `NodeNext` with mandatory `.js` import extensions
**Context.** Init interview, question 5. Majority choice across the audited projects; the extension
rule is invisible and mandatory.
**Decision.** `module` and `moduleResolution` `NodeNext`, `"type": "module"` in every package,
`verbatimModuleSyntax` on. Every relative import ends in `.js`, even in `.ts` source.
**Rejected.** CommonJS: cuts the project off from ESM-only dependencies. Bundler resolution: hides
the extension rule until something runs outside the bundler.
**Consequence.** A forgotten `.js` compiles and fails at runtime; `CLAUDE.md` states the rule.
Supersedes: none.

### 2026-09-07 — Vitest, running against source, tests under `test/` mirroring `src/`
**Context.** Init interview, question 6. Two audited projects chose Vitest deliberately; the
project that tested compiled output edited `.ts` and re-ran the test against the old build.
**Decision.** Vitest 3, one root config, `include` of `{apps,packages}/*/test/**/*.test.ts`,
`passWithNoTests` so an empty package does not fail the gate. Tests import source directly; the
`test` script does not build first.
**Rejected.** Node's built-in runner: fine, but no watch/UI ergonomics and no alias support for the
shared-package split. Compiled-output tests: the stale-build trap above.
**Consequence.** If a runtime ever demands compiled tests, the `test` script must build first and
this entry is superseded. Supersedes: none.

### 2026-09-07 — ESLint 10 flat config + Prettier, format check in the gate
**Context.** Init interview, question 7. Three of four audited projects had no linter at all. The
recommended default named ESLint 9, but on the day of init ESLint 9 is marked deprecated on the
registry and typescript-eslint 8.69 supports 10.
**Decision.** ESLint 10 with `defineConfig`, `@eslint/js` recommended + typescript-eslint
recommended, `eslint-config-prettier` last. Prettier at 100 columns. Markdown is excluded from
Prettier (it would re-pad every table in this file). ESLint also enforces the config-module rule:
`process.env` is an error outside `packages/shared/src/config.ts`.
**Rejected.** ESLint 9: starting a new project on a deprecated major. Type-aware lint rules:
too slow for a pre-commit hook; revisit when the codebase justifies it.
**Consequence.** `pnpm run lint` and `pnpm run format:check` run in the pre-commit hook and CI.
Supersedes: none.

### 2026-09-07 — Defer the deploy target
**Context.** Init interview, question 8. No target was chosen; the app does not exist yet.
**Decision.** None yet. `README.md` says so. When one is chosen it gets its own dated entry, a
workflow that declares `needs: test`, and the runtime pin list in `CLAUDE.md` is updated.
**Rejected.** Picking one now to fill the placeholder: two audited projects' real deploy mechanism
was recoverable only by inference, which is what a guessed answer would become.
**Consequence.** The "Deploy target" row stays in the open-variants table below. Supersedes: none.
_Superseded by 2026-09-07 "Host on Azure at the lowest tier of everything"._

### 2026-09-07 — Thin entry points in `apps/<app>/src/routes/`, logic in `lib/`, manual registration
**Context.** Init interview, question 9. Both opinionated audited projects chose layer-per-folder
and both cited testability.
**Decision.** Each app keeps its HTTP handlers or pages in `src/routes/`, thin, calling named
functions in `lib/` that import no framework. A new route is registered by hand in that app's
`src/routes/index.ts`; the registration bullet stays in `CLAUDE.md` because nothing errors when it
is skipped.
**Rejected.** Feature folders (`modules/<feature>/`): fine at scale, premature for a two-feature app.
Filesystem auto-discovery: depends on a framework that is not chosen yet; supersede this when it is.
**Consequence.** Tests call `lib/` functions directly without booting a server. Supersedes: none.

### 2026-09-07 — kebab-case filenames; Title Case for UI headings and buttons
**Context.** Init interview, question 10. Both were re-litigated on a live audited project and one
had to be pinned with a date to stick.
**Decision.** kebab-case for every filename except `PascalCase.tsx` components. Title Case for
headings and buttons in UI copy.
**Rejected.** camelCase filenames and sentence-case copy — either would do; the point is to pick
once.
**Consequence.** A correction on either is a `Pinned preferences` line in `CLAUDE.md`, not a
discussion. Supersedes: none.

### 2026-09-07 — `docs/spec/` and `docs/runbooks/` are the doc topic folders
**Context.** Init interview, question 11. Seventeen root markdown files in one audited project
needed an index to be usable.
**Decision.** `docs/spec/` (one file per feature, written before the code) and `docs/runbooks/`
(one file per operating procedure). Root keeps only `README`, `SETUP`, `DECISIONS`, `STATUS`,
`CLAUDE`.
**Rejected.** `docs/security/`, `docs/deploy/`: nothing to put in them yet; add a folder when its
first file exists, and update the `CLAUDE.md` doc index in the same commit.
**Consequence.** A new root-level `.md` file is a smell. Supersedes: none.

### 2026-09-07 — Read the environment only in `packages/shared/src/config.ts`
**Context.** Init interview, question 12, and the template's config-module rule. One audited
project read `process.env` in 36 places and could enumerate its own configuration only by grep.
**Decision.** `loadConfig()` validates a zod `.strict()` schema over exactly the declared keys and
throws a `ConfigError` (code `CONFIG_INVALID`, the offending variable names, remediation text). Day
one reads `NODE_ENV`, `PORT`, `LOG_LEVEL`, all with defaults; `.env.example` documents each.
**Rejected.** dotenv with direct reads: the 36-places outcome. A `required()` helper alone: reports
one missing variable per restart instead of all at once.
**Consequence.** Every new variable is a schema line and an `.env.example` line in the same commit;
ESLint rejects `process.env` elsewhere. Supersedes: none.

### 2026-09-07 — No `.mcp.json`
**Context.** Template setup step 7. Absent in all four audited projects; the MCP tools that appeared
in sessions came from the environment, not the repo.
**Decision.** None. Absent-by-decision, recorded here so it does not look absent-by-accident.
**Rejected.** Adding one speculatively: it would declare a dependency no code has.
**Consequence.** Add one only when a server is genuinely a project dependency, with a superseding
entry. Supersedes: none.

---

## Open variants

Every row below is something all four audited projects needed and answered differently, or answered
by accident. Every **decide first** row was settled on 2026-09-07 (entries above). A row left unanswered becomes a convention by default, which is how most of these got their
current answers.

### Repo and code

| Item | Options seen | Recommended default | Why |
|---|---|---|---|
| Validation | zod at boundaries (three projects); none | zod, `.strict()`, `safeParse` at every boundary | Effectively already standard; promoted out of this table into `CLAUDE.md` |
| Data access | `withTenant()` transaction wrapper, raw pool unexported; `safeBusinessId()` at every call site; direct table client; none | One guarded entry point, raw handle unexported | Both projects with the rule had it undocumented, and both listed it as the top fresh-start hazard |
| Migrations | Numbered hand-written SQL with explicit RLS/grants + tiny runner; none; none; none | Numbered, forward-only, hand-authored, idempotent runner | Only one project has an answer, but "easy to wrongly run `drizzle-kit generate`" is a real trap worth pinning |
| Error-handling depth | Per-module error classes with HTTP status; typed codes with remediation text; gate objects + degrade-don't-throw; sparse local `try/catch` | Typed error codes + remediation text; secondary side effects never fail the primary action | Two projects converged on codes; the degrade rule was restated across six modules in the third |
| Logging | pino structured with event names; `console.*`; `console.*`; framework `context.log` | Structured logger with event-name strings | Only one project does it, but it is the only one that can answer "what failed last Tuesday" |
| Secret storage | `.env` + AES-256-GCM at rest for one webhook; Azure App Service config + GH Actions secrets; Function App settings + Key Vault; a live signed URL hardcoded in source | Platform secret store + GH Actions secrets; `.env` local only | The hardcoded-secret project is the cautionary case; never carry that pattern forward |
| Second code population | ES5 browser globals alongside modern Node tooling | Avoid; if unavoidable, state the constraint and mark duplicated symbols | Duplicated compute logic in three parallel copies meant the same bug was fixed by hand three times |
| Version strings | Four different schemes inside one repo; package `version` only | One scheme, stated | Nobody could tell which build was live |
| `noUncheckedIndexedAccess` | On (one project); unset elsewhere | On for new projects | Cheap on day one, expensive to retrofit |

### Quality gates

| Item | Options seen | Recommended default | Why |
|---|---|---|---|
| Local enforcement | None; none; none; none — all four honour-system | Git `pre-commit` running typecheck + lint + format; tests in the gate script and CI | Three friction logs asked for exactly this; keep the hook fast so nobody learns `--no-verify` |
| What CI blocks | Nothing (no CI); CI on all branches after the fact; nothing; `test` job that both deploy jobs `need` | `test` job on every push, every deploy job `needs: test` | The `needs: test` shape is the only one that actually stops a bad deploy |
| Which typechecks are in the gate | Per-package only, no root aggregate; root + a package relying on `next build`; n/a; API in the gate, web only in the deploy job | Every package, in the gate | A web-only type error failing the deploy job instead of the test job was named as a gap |
| Test fixtures | Sanitized workbooks committed with gitignore exceptions; none | Sanitized fixtures committed, format blocked globally | Otherwise the suite depends on files that exist on one machine |
| LLM output evaluation | Manual comparison against client deliverables | Golden-answer harness from day one if the product ships model output | Named as missing; accuracy currently rests on one person's eyes |

### Git and delivery

| Item | Options seen | Recommended default | Why |
|---|---|---|---|
| Commit subject | `Area: imperative`; `Area: imperative`; imperative sentence case with occasional `Area:`; mixed, ~12% `type:` prefixes | Imperative sentence case, optional `Area:` scope, no conventional-commits | Three of four already do it; the fourth is the one with no convention at all |
| Commit body | Multi-paragraph why; multi-paragraph why; six-paragraph why; short | Prose body: problem, decision, rejected alternative, consequence | Called "the single strongest convention in the repo and documented nowhere" |
| Trailers | Both on 100% of commits; both on recent commits; both, inconsistently; none | Both, on every commit | Consistency is the variant worth copying, not the presence |
| Branch naming | `claude/<slug>`; `claude/<adjective-hash>` + a private data branch; `feature/<slug>`; `<kind>/<slug>` incl. `claude/`, `docs/`, `review/` | `<kind>/<slug>`, `claude/` for agent sessions | Superset of the others; agree the kinds up front |
| PR template / CODEOWNERS | None in any of the four | A short PR template: what changed, why, what you ran | Three listed it under missing-before-day-one |
| Where production data lives | A private `data-deploy` git branch merged at build; gitignored runtime files; n/a; cloud storage | Never a git branch | Works, but couples a data update to a deploy |
| Windows launcher | `start.bat` with `git fetch` + `reset --hard`; `start-backend.bat`; two `.bat` launchers; `start.bat` with `reset --hard` | Keep the launcher, drop the hard reset — refuse to start on a dirty tree | Present in three of four, and the reset silently destroys uncommitted work |

### Ops and product shape

| Item | Options seen | Recommended default | Why |
|---|---|---|---|
| Session/build-time tracking | Automated `SessionStart`/`SessionEnd` hook to an orphan branch; manual `TIMELOG.md` row per session; none; none | The automated hook | Two projects wanted the data; the manual one started months late and its earlier hours are unrecoverable estimates |
| Claude Code commands/agents | None in any of the four | Ship `/gate`, `/ship`, `/decision`, `/preflight`; no subagents until a repeated review actually exists | Every repeated operation was "a remembered incantation" in all four |
| Dev/seed endpoint gate | Three-state `DEV_TOOLS` (`on`/`off`/environment-detected), endpoints 404 when off | Copy the three-state pattern | "Do not let a synthetic record touch a real tenant" needed three enforcement points before it stuck |
| Committing the dependency manifest | Committed (three); `package.json` and lockfile deliberately gitignored | Commit it | The gitignored one was lost during a branch cleanup and rebuilt from memory |
