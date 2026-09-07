# Starting a new project from this template

Work top to bottom. Each step's placeholders depend on decisions made in the steps above it, so
filling them out of order means filling some of them twice.

Placeholders live in `CLAUDE.md`, `.claude/commands/*.md`, `.githooks/pre-commit` and
`.github/workflows/ci.yml`. The `${{ ... }}` expressions in `ci.yml` are GitHub Actions syntax —
leave those alone; only `{{DOUBLE_BRACE}}` names are yours to fill.

---

## 1. Decide before you write any code

Open `DECISIONS.md` and settle the rows marked **decide first**: repo shape, package manager, Node
major, test runner, linter/formatter, deploy target. Record each as a dated entry using the format
at the top of that file. Everything below assumes these are decided.

Fill now:

- `{{PROJECT_NAME}}`, `{{ONE_LINE_PURPOSE}}` — CLAUDE.md
- `{{NODE_MAJOR}}` — CLAUDE.md, ci.yml, `package.json` `engines`. **One number in all three.** Two
  of the four source projects disagreed with themselves here; one of those disagreements cost a
  production outage where the app deployed successfully and then indexed zero functions.
- `{{RUNTIME_PINS}}` — list the other files that pin the runtime, or write "none"
- `{{PKG_MANAGER}}`, `{{CI_INSTALL_CMD}}` — CLAUDE.md, ci.yml
- `{{TRUNK}}` — CLAUDE.md

## 2. Scaffold the repo

Create the layout, the shared types/schemas module, and `scripts/`. Then fill:

- `{{LAYOUT}}`, `{{SHARED_MODULE}}`, `{{ENTRY_DIR}}` — CLAUDE.md
- `{{REGISTRATION_STEP}}` — CLAUDE.md. If the framework auto-discovers routes, delete that line
  rather than leaving a placeholder in it.
- `{{FILE_CASE}}`, `{{UI_COPY_CASE}}` — CLAUDE.md. Pick once, now; both were re-litigated on a live
  project and one had to be pinned with a date to make it stick.

Write `.gitignore` with a comment on every unusual entry, especially anything committed *on
purpose*, and specifically:

```
node_modules/
dist/
coverage/
.env
*.log
*.tsbuildinfo
.claude/settings.local.json
.claude/sessions.csv        # restored from the `worklog` branch by the session hook
```

Block customer-data formats globally and whitelist sanitized fixtures explicitly.

## 3. Wire the gate

Add the scripts — `typecheck` (aggregating **every** package), `lint`, `format` / `format:check`,
`test`, `build`, and a `gate` that runs them all. Then fill:

- `{{GATE_CMD}}`, `{{GATE_TYPECHECK_CMD}}`, `{{GATE_LINT_CMD}}`, `{{GATE_FORMAT_CMD}}`,
  `{{GATE_TEST_CMD}}` — CLAUDE.md, `.claude/commands/gate.md`, `.githooks/pre-commit`, `ci.yml`
- `{{TEST_RUNNER}}`, `{{TEST_TARGET}}` — CLAUDE.md. If tests run against compiled output, the
  `test` script builds first.

Then:

```
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .claude/hooks/session-log.sh
```

Commit `.github/workflows/ci.yml` before the first feature commit, so the first thing merged is
already gated.

## 4. Environment and secrets

Write `.env.example` before writing the code that reads the vars: every variable, one line of
explanation each, required vs degrades-gracefully marked, and the generation command inline for
anything secret. Add the config module that reads them and fails fast by name.

- `{{CONFIG_MODULE}}` — CLAUDE.md
- `{{DATA_GUARD}}` — CLAUDE.md. Name the single guarded data-access entry point and make the raw
  handle unexported the day you create it, not later.

## 5. Setup script

Write `{{SETUP_CMD}}` (usually `npm run setup`) so that a fresh clone reaches a running dev server
with that one command: install in every workspace in the right order, copy `.env.example` to
`.env`, seed any data file the app refuses to boot without, and start or check any local
emulator/database. Where it can't do something, it prints the exact command that will.

- `{{SETUP_CMD}}`, `{{DEV_CMD}}` — CLAUDE.md, `.claude/commands/preflight.md`

Then verify it: clone into a clean directory and run only that command. All four source projects
broke here, each in a way that was documented only inside a `.bat` file comment or nowhere at all.

## 6. Docs

Create `README.md` (quick start, layout, architecture), `DECISIONS.md`, `STATUS.md`, and `docs/`
with the topic folders you actually need. Fill `{{DOC_TOPICS}}` in CLAUDE.md. Put the editable
source of every generated asset in `docs/` from the start — one project lost a shipped PDF's source
because it lived outside the repo.

## 7. Claude Code wiring

- `{{CLAUDE_TRAILER}}` — CLAUDE.md, `.claude/commands/ship.md`. Update it when the model changes.
- Run one session so `SessionStart` creates `.claude/sessions.csv` and the `worklog` branch. Check
  `bash .claude/hooks/session-log.sh report`. The ledger only works if it starts on day one.
- Do **not** add a `.mcp.json`. None of the four projects needed one; the MCP tools that showed up
  during their sessions came from the environment, not the repo. Add one only when a server is
  genuinely a project dependency, and record that as a decision.
- `.claude/settings.local.json` stays gitignored and uncommitted.

## 8. First commit

Commit the template itself with the house message format before any feature work, so `git log` is
an example of the convention from its first line. Then delete the example line under **Pinned
preferences** in `CLAUDE.md` when the first real correction lands there.
