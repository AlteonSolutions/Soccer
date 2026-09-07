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

---

## Open variants

Every row below is something all four audited projects needed and answered differently, or answered
by accident. Settle the **decide first** rows before writing code; record each as a dated entry
above. A row left unanswered becomes a convention by default, which is how most of these got their
current answers.

### Decide first

| Item | Options seen across the four projects | Recommended default | Why |
|---|---|---|---|
| Repo shape | `apps/*` + `packages/*` npm workspaces; `apps/*` + `packages/*` pnpm workspaces; root `src/` + a second app with its own `node_modules`; flat single-directory | `apps/*` + `packages/*` workspaces, one manager, one lockfile | The two-tree layout produced an install-order gotcha documented only inside a CI comment |
| Package manager | npm; pnpm 10.12.1 (pinned via `packageManager`); none (manifest gitignored) | pnpm, pinned in `packageManager` | The only project that pinned it never had an install ambiguity |
| Node major | `>=22`; `>=22`; `>=20` in package.json but `22` in CI and `'22'` in IaC; unstated | One number, repeated in `engines`, CI and IaC, changed together | The three-way disagreement caused a deploy that "succeeded" and then indexed zero functions |
| Module system | ESM `NodeNext` with mandatory `.js` import extensions; ESM; CommonJS for the API + bundler-resolved source for web; ES5 `<script>` globals | ESM `NodeNext` | Majority; the `.js`-extension requirement must then be stated in `CLAUDE.md` — it is invisible and mandatory |
| Test runner | Vitest 3; Vitest; hand-rolled `node:assert` scripts (2,175 lines); a bespoke diff CLI wired to nothing | Vitest | Two projects chose it deliberately; the hand-rolled suites are good tests with no runner ergonomics |
| Linter + formatter | ESLint 9 flat + Prettier; none; none; none | ESLint flat + Prettier, config committed, `format:check` in the gate | Three of four listed "any linter at all" under what's missing before day one |
| Deploy target | Azure App Service via ACR Docker images; Azure Static Web Apps + Functions Flex; GitHub Pages + manual paste into a CMS; unknown / run-from-source `.bat` | Whatever it is, name it in `README.md` and make one workflow the only path to it | Two projects' real deploy mechanism was recoverable only by inference |

### Repo and code

| Item | Options seen | Recommended default | Why |
|---|---|---|---|
| Folder organisation | `core/` infra vs `modules/<feature>/`; layered `routes/ tools/ lib/`; layered `functions/ lib/ pages/ components/`; flat | Layer-per-folder: thin entry points in one folder, logic in `lib/` | Two of three opinionated projects chose it, and both cite testability as the reason |
| Shared code: source or build | Raw `.ts`, no build step, consumed directly; cross-tree relative imports; built to `dist` for API but aliased to source for web | Build once to `dist`; if you consume source anywhere, say so in `CLAUDE.md` | The split-consumption project flagged it as a thing you'd get wrong fresh |
| Validation | zod at boundaries (three projects); none | zod, `.strict()`, `safeParse` at every boundary | Effectively already standard; promoted out of this table into `CLAUDE.md` |
| Data access | `withTenant()` transaction wrapper, raw pool unexported; `safeBusinessId()` at every call site; direct table client; none | One guarded entry point, raw handle unexported | Both projects with the rule had it undocumented, and both listed it as the top fresh-start hazard |
| Migrations | Numbered hand-written SQL with explicit RLS/grants + tiny runner; none; none; none | Numbered, forward-only, hand-authored, idempotent runner | Only one project has an answer, but "easy to wrongly run `drizzle-kit generate`" is a real trap worth pinning |
| Error-handling depth | Per-module error classes with HTTP status; typed codes with remediation text; gate objects + degrade-don't-throw; sparse local `try/catch` | Typed error codes + remediation text; secondary side effects never fail the primary action | Two projects converged on codes; the degrade rule was restated across six modules in the third |
| Logging | pino structured with event names; `console.*`; `console.*`; framework `context.log` | Structured logger with event-name strings | Only one project does it, but it is the only one that can answer "what failed last Tuesday" |
| Env access | `required()` helper that throws; dotenv + direct reads; direct `process.env` in 36 places; hardcoded in source | One config module, fail fast, name the missing variable | The 36-var project could only enumerate its own config by grep |
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
| Tests: source or compiled | Source; source; n/a; compiled `dist` | Source, unless the runtime demands otherwise; if compiled, `test` builds first | Editing `.ts` and re-running the test file tested the old build |
| Test layout | `test/` sibling mirroring `src/` (three); none | `test/` mirroring source | Already near-unanimous |
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
| `.mcp.json` | Absent in all four; session MCP tools came from the environment | None, and record that as the decision | Absent-by-accident and absent-by-decision look identical six months later |
| Local emulator | Azurite as a devDependency with a connection-string fallback; Azurite in CI only; Docker Compose Postgres; none | Emulator as a devDependency with a fallback so a clone runs unconfigured | The only project where a fresh clone just worked |
| IaC | Bicep, authored, never applied, live names differ | If it exists it is authoritative; if it is not, say so in line one of the file | The doc said "not yet applied" while the workflow was already deploying |
| Docs topic folders | `docs/SPEC.md` as source of truth; 17 root `.md` files; none; `docs/{security,runbooks,pitch}/` | `docs/` with topic folders + a doc index in `CLAUDE.md` | 17 root markdown files needed an index to be usable |
| Auth model | Session + role CHECK + row-level security; JWT + magic links; none; Entra + a per-page gate object | Project-specific | Genuinely determined by the product |
| Multi-tenancy | RLS with `SET LOCAL app.tenant_id`; tenant JSON file; none; partition-key-per-tenant | Enforce at the data layer, not the query site, when the database supports it | The RLS project could not leak across tenants even with a bug in a handler |
| Dev/seed endpoint gate | Three-state `DEV_TOOLS` (`on`/`off`/environment-detected), endpoints 404 when off | Copy the three-state pattern | "Do not let a synthetic record touch a real tenant" needed three enforcement points before it stuck |
| Side-effect integrations | SMTP + Teams webhooks behind a `*_LIVE` capture-vs-send flag; Resend; ACS email | Capture-vs-send flag, defaulting to capture | Both projects that send mail invented the same flag independently |
| UI copy casing + tokens | Title Case + `hf-*` tokens; unstated elsewhere | Pick on day one and pin it with a date | It was corrected, then re-corrected, then dated to make it stick |
| Committing the dependency manifest | Committed (three); `package.json` and lockfile deliberately gitignored | Commit it | The gitignored one was lost during a branch cleanup and rebuilt from memory |
