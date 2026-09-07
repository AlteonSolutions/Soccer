# Fresh-clone checklist

One command should do all of this: `pnpm run setup`. The list below is what that command does and
checks, so that when it cannot do a step you know what it wanted.

## 1. Node 22

`node -v` must start with `v22`. The major is pinned in `package.json` `engines`, `.npmrc` sets
`engine-strict`, and CI uses the same number. Install from https://nodejs.org/ or
`nvm install 22 && nvm use 22`.

## 2. pnpm 10.33.0

The version is pinned in `package.json` `packageManager`. Get it with
`corepack enable && corepack prepare pnpm@10.33.0 --activate`. Do not install with npm or yarn —
the lockfile is pnpm's and CI installs it frozen.

## 3. Dependencies

`pnpm install --frozen-lockfile`, from the root. That installs every workspace. If it fails because
the lockfile is stale, someone forgot to commit `pnpm-lock.yaml`; run `pnpm install` and commit it.

## 4. `.env`

Copied from `.env.example` if absent. Every variable in it is documented there with whether it is
required or has a default. Today every variable is optional. `.env` is gitignored; never commit it.

## 5. Git hooks

`git config core.hooksPath .githooks` enables the pre-commit hook (typecheck + lint + format check).
It is per-clone git config, which is why setup does it rather than the repo.

## 6. Verify

`pnpm run gate` runs the full gate. It must pass on a fresh clone; if it does not, that is a bug in
this repo, not in your machine — say so.

`pnpm run dev` starts every app's dev server. There is no app in `apps/` yet, so today it starts
nothing; `STATUS.md` says what is next.

## 7. Claude Code

Open Claude Code in the repo once. The `SessionStart` hook creates `.claude/sessions.csv` (gitignored)
and a `worklog` branch that persists it. `bash .claude/hooks/session-log.sh report` shows the hours
ledger. `.claude/settings.local.json` is per-machine and stays uncommitted. There is no `.mcp.json`
on purpose (see `DECISIONS.md`).
