# INIT — run once, then delete

Paste this into Claude Code in the fresh repo:

> Read `INIT.md` and follow it exactly.

Everything below is addressed to Claude.

---

You are initializing a new project from the Alteon standard template. This repo is currently the
template: 27 `{{PLACEHOLDER}}` names are unfilled and the CI workflow is parked as
`.github/workflows/ci.yml.tpl` so GitHub does not try to run it before it is valid.

Do not skip the interview and do not guess a value that was not given to you. A wrong `NODE_MAJOR`
in one of three places is the single failure this template exists to prevent.

## Step 1 — Read first

Read `CLAUDE.md`, `SETUP.md`, and `DECISIONS.md` in full before asking anything. `DECISIONS.md`
carries the recommended default and the reasoning for most of what you are about to ask; use those
as the proposed answers rather than inventing your own.

Then run `ls -a` and `git log --oneline -5` and tell me in one line whether this repo is empty or
already has code in it. If it already has code, every question below is answered by reading what is
there first and confirming with me — not by asking cold.

## Step 2 — Interview

Ask me these in **one batch**, each with the `DECISIONS.md` recommended default pre-filled so I can
accept it by saying "defaults". Do not ask them one at a time.

1. Project name and one-sentence purpose — who uses it and what it does.
2. Repo shape: workspaces (`apps/*` + `packages/*`) or single package.
3. Package manager and version.
4. Node major — one number.
5. Module system: ESM `NodeNext` or CommonJS.
6. Test runner, and whether tests run against source or compiled output.
7. Linter/formatter: ESLint flat + Prettier, or something else.
8. Deploy target — be specific (Azure App Service via ACR, Static Web Apps + Functions, Pages, none yet).
9. Entry-point folder name, and whether new entry points need manual registration or are auto-discovered.
10. Filename case, UI copy case (Title Case vs sentence case).
11. `docs/` subfolders this project actually needs.
12. Anything the app reads from the environment on day one.

Where an answer implies another (workspaces implies a `packages/shared`; compiled tests imply the
`test` script builds first), state the implication rather than asking a follow-up question.

## Step 3 — Fill

Replace **every** `{{PLACEHOLDER}}` across `CLAUDE.md`, `SETUP.md`, `.claude/commands/*.md`,
`.githooks/pre-commit`, and the CI workflow. Rules:

- `{{NODE_MAJOR}}` is one number and must be byte-identical in `CLAUDE.md`, `package.json`
  `engines`, the CI workflow, and any IaC parameter. List back to me every file you wrote it into.
- `{{RUNTIME_PINS}}` is that list. If there is nowhere else, write "none" — not an empty string.
- The `${{ ... }}` expressions in the CI workflow are GitHub Actions syntax. Leave them alone.
  Only `{{DOUBLE_BRACE}}` names are yours.
- `{{REGISTRATION_STEP}}`: if the framework auto-discovers, delete that whole bullet from
  `CLAUDE.md` rather than writing "n/a" into it.
- Delete the dated example line under **Pinned preferences** in `CLAUDE.md`.

Then two things the placeholders do not cover:

- **Package manager in the tooling.** `.claude/settings.json` and the `allowed-tools` frontmatter of
  `.claude/commands/*.md` hardcode `npm run …`. If the chosen manager is not npm, rewrite those
  patterns to match (`Bash(pnpm run typecheck:*)` and so on). A stale pattern here does not error —
  it just makes me approve every command by hand, which is how the permission list gets abandoned.
- **Activate CI.** `git mv .github/workflows/ci.yml.tpl .github/workflows/ci.yml` once its
  placeholders are filled, then confirm it is valid YAML.

## Step 4 — Scaffold what the template assumes exists

- `package.json` with the scripts `CLAUDE.md` promises: `setup`, `dev`, `typecheck` (aggregating
  **every** workspace), `lint`, `format`, `format:check`, `test`, `build`, and `gate` running the
  full set. Set `engines.node` and `packageManager`. If a `package.json` already exists, add only
  the missing scripts and show me the diff first.
- `.env.example` — every variable from question 12, one line of explanation each, required vs
  degrades-gracefully marked, and the generation command inline for anything secret.
- The config module named by `{{CONFIG_MODULE}}`, reading env in exactly one place and failing fast
  with the missing variable's name.
- `README.md` (quick start, layout, architecture), `STATUS.md`, and the `docs/` subfolders.
- The `setup` script itself, per `SETUP.md` step 5: a fresh clone reaches a running dev server with
  that one command, and where it cannot do something it prints the exact command that will.

Do not scaffold application code, a framework, or a directory tree I did not ask for.

## Step 5 — Wire the hooks

```
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit .claude/hooks/session-log.sh
```

Tell me to restart the Claude Code session once, so `SessionStart` creates `.claude/sessions.csv`
and the `worklog` branch. The build-time ledger is only worth anything if it starts on day one.

## Step 6 — Record the decisions

Every answer from Step 2 that `DECISIONS.md` lists as a variant becomes a dated entry at the top of
`DECISIONS.md`, in that file's format, with **Supersedes: none**. Then delete the "Open variants"
tables for the rows now decided — leave the rows that are still genuinely open. A decided item
sitting in an "open" table is how a settled choice gets re-litigated six months later.

## Step 7 — Verify, then commit

Run all of these and report the real result. Do not write "should pass".

1. `grep -rn '{{' . --exclude-dir=node_modules --exclude-dir=.git` returns nothing except the
   GitHub Actions `${{ … }}` lines in the CI workflow.
2. The CI workflow parses as YAML.
3. `npm run gate` (or the chosen manager's equivalent) runs end to end. It may report zero tests;
   it may not error.
4. `.gitignore` covers `.env` and `.claude/settings.local.json`.
5. `git status` shows no `.env`, no `settings.local.json`, no customer-data file staged.

Then `rm INIT.md` and make the first commit using the house format from `CLAUDE.md` — imperative
sentence-case subject, prose body giving the problem, the decision, the alternative rejected and the
consequence, and both trailers. That first commit is the worked example of the convention for
everything after it, so write it properly.
