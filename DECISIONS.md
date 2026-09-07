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
by accident. The **decide first** rows were settled on 2026-09-07 (entries above) except the one still listed. A row left unanswered becomes a convention by default, which is how most of these got their
current answers.

### Decide first

| Item | Options seen across the four projects | Recommended default | Why |
|---|---|---|---|
| Deploy target | Azure App Service via ACR Docker images; Azure Static Web Apps + Functions Flex; GitHub Pages + manual paste into a CMS; unknown / run-from-source `.bat` | Whatever it is, name it in `README.md` and make one workflow the only path to it | Two projects' real deploy mechanism was recoverable only by inference |

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
| Real deps vs mocks | Real Postgres with an RLS guard refusing privileged roles; Azurite emulator, self-skipping locally; Azurite booted by the test itself; none | Emulator/real dependency, self-skipping when unconfigured | Both projects that mocked nothing caught the bugs that mattered |
| Test fixtures | Sanitized workbooks committed with gitignore exceptions; none | Sanitized fixtures committed, format blocked globally | Otherwise the suite depends on files that exist on one machine |
| LLM output evaluation | Manual comparison against client deliverables | Golden-answer harness from day one if the product ships model output | Named as missing; accuracy currently rests on one person's eyes |

### Git and delivery

| Item | Options seen | Recommended default | Why |
|---|---|---|---|
| Commit subject | `Area: imperative`; `Area: imperative`; imperative sentence case with occasional `Area:`; mixed, ~12% `type:` prefixes | Imperative sentence case, optional `Area:` scope, no conventional-commits | Three of four already do it; the fourth is the one with no convention at all |
| Commit body | Multi-paragraph why; multi-paragraph why; six-paragraph why; short | Prose body: problem, decision, rejected alternative, consequence | Called "the single strongest convention in the repo and documented nowhere" |
| Trailers | Both on 100% of commits; both on recent commits; both, inconsistently; none | Both, on every commit | Consistency is the variant worth copying, not the presence |
| Branch naming | `claude/<slug>`; `claude/<adjective-hash>` + a private data branch; `feature/<slug>`; `<kind>/<slug>` incl. `claude/`, `docs/`, `review/` | `<kind>/<slug>`, `claude/` for agent sessions | Superset of the others; agree the kinds up front |
| Delivery flow | Long-lived branch, no PRs; direct pushes to main; manual paste; PR merge commits, one commit per PR, no squash | PRs into trunk, squash, one branch per change | The long-lived-branch project needed 15 PRs to merge one branch |
| PR template / CODEOWNERS | None in any of the four | A short PR template: what changed, why, what you ran | Three listed it under missing-before-day-one |
| Where production data lives | A private `data-deploy` git branch merged at build; gitignored runtime files; n/a; cloud storage | Never a git branch | Works, but couples a data update to a deploy |
| Windows launcher | `start.bat` with `git fetch` + `reset --hard`; `start-backend.bat`; two `.bat` launchers; `start.bat` with `reset --hard` | Keep the launcher, drop the hard reset — refuse to start on a dirty tree | Present in three of four, and the reset silently destroys uncommitted work |

### Ops and product shape

| Item | Options seen | Recommended default | Why |
|---|---|---|---|
| Session/build-time tracking | Automated `SessionStart`/`SessionEnd` hook to an orphan branch; manual `TIMELOG.md` row per session; none; none | The automated hook | Two projects wanted the data; the manual one started months late and its earlier hours are unrecoverable estimates |
| Claude Code commands/agents | None in any of the four | Ship `/gate`, `/ship`, `/decision`, `/preflight`; no subagents until a repeated review actually exists | Every repeated operation was "a remembered incantation" in all four |
| Local emulator | Azurite as a devDependency with a connection-string fallback; Azurite in CI only; Docker Compose Postgres; none | Emulator as a devDependency with a fallback so a clone runs unconfigured | The only project where a fresh clone just worked |
| IaC | Bicep, authored, never applied, live names differ | If it exists it is authoritative; if it is not, say so in line one of the file | The doc said "not yet applied" while the workflow was already deploying |
| Auth model | Session + role CHECK + row-level security; JWT + magic links; none; Entra + a per-page gate object | Project-specific | Genuinely determined by the product |
| Multi-tenancy | RLS with `SET LOCAL app.tenant_id`; tenant JSON file; none; partition-key-per-tenant | Enforce at the data layer, not the query site, when the database supports it | The RLS project could not leak across tenants even with a bug in a handler |
| Dev/seed endpoint gate | Three-state `DEV_TOOLS` (`on`/`off`/environment-detected), endpoints 404 when off | Copy the three-state pattern | "Do not let a synthetic record touch a real tenant" needed three enforcement points before it stuck |
| Side-effect integrations | SMTP + Teams webhooks behind a `*_LIVE` capture-vs-send flag; Resend; ACS email | Capture-vs-send flag, defaulting to capture | Both projects that send mail invented the same flag independently |
| Committing the dependency manifest | Committed (three); `package.json` and lockfile deliberately gitignored | Commit it | The gitignored one was lost during a branch cleanup and rebuilt from memory |
