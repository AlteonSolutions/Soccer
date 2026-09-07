# alteon-project-template

The standard starting point for Alteon Solutions projects. Synthesized from audits of four existing
Claude Code projects — every rule in here earned its place by having been a real correction, a real
outage, or a real thing that broke on a fresh clone.

**This README is replaced during init.** If you are reading it inside a project, init has not run.

## Starting a new project

1. On GitHub: **Use this template → Create a new repository**.
2. Clone it and open Claude Code in it.
3. Paste: `Read INIT.md and follow it exactly.`

`INIT.md` interviews you on the ~12 real decisions, fills all 27 placeholders across every file,
scaffolds `package.json` / `.env.example` / docs, wires the hooks, records the decisions, verifies
the result, and deletes itself.

Doing it by hand instead: work through `SETUP.md` top to bottom. Same outcome, more typing, and the
`NODE_MAJOR`-in-three-places check is on you.

## What's in here

| Path | What it is |
|---|---|
| `CLAUDE.md` | The house rules. The main artifact — everything else enforces some line in it. |
| `SETUP.md` | Ordered fresh-clone checklist, with which placeholders belong to which step. |
| `DECISIONS.md` | Entry format, plus the open-variant tables with a recommended default per row. |
| `INIT.md` | The one-time bootstrap prompt. Deleted at the end of init. |
| `.claude/settings.json` | Permission allow/deny list and the session-logging hooks. |
| `.claude/commands/` | `/gate`, `/preflight`, `/ship`, `/decision`. |
| `.claude/hooks/session-log.sh` | Build-time ledger → `.claude/sessions.csv`, persisted to a `worklog` branch. |
| `.githooks/pre-commit` | Typecheck + lint + format, enforced. Tests stay in `gate` and CI. |
| `.github/workflows/ci.yml.tpl` | CI. Parked as `.tpl` until its placeholders are filled — see below. |
| `.gitignore` | Includes the Claude Code entries and blocks customer-data formats by extension. |

## Two things that are easy to get wrong

**The CI workflow is parked.** In template state, `run: {{GATE_TEST_CMD}}` is not valid YAML — `{`
opens a flow mapping. Left as `ci.yml`, every push to this template repo and to every repo created
from it would fail with an invalid-workflow error before you'd written a line of code. It stays
`.tpl` (which GitHub ignores) until init fills it and renames it.

**`npm` is hardcoded in two places the placeholders don't reach**: the permission patterns in
`.claude/settings.json` and the `allowed-tools` frontmatter in `.claude/commands/*.md`. If a project
uses pnpm, those patterns silently stop matching — nothing errors, you just get an approval prompt
for every command until you give up on the allow-list. Init rewrites them; if you're hand-filling,
do it yourself.

## Changing the template

Fixes belong here, not in the project that found them. When a project adds a line under **Pinned
preferences** in its `CLAUDE.md` and that correction would apply anywhere, port it back and note the
originating project in the commit body.

Re-audit periodically: point the audit prompt at projects started *from* this template and diff the
`CLAUDE.md`, `.claude/`, and friction-log sections. Anything that drifted is either a gap in the
template or a rule nobody actually follows — both are worth knowing.
