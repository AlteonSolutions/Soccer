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

## 6. Azure Functions Core Tools

`pnpm run dev` runs the API through the Static Web Apps CLI, which needs `func` on PATH. Setup
checks and prints the install command (`npm install -g azure-functions-core-tools@4`, or winget on
Windows). The gate does not need it.

## 7. Verify

`pnpm run gate` runs the full gate. It must pass on a fresh clone; if it does not, that is a bug in
this repo, not in your machine — say so. With Azurite running (`pnpm run dev:storage`) the gate also
exercises the real Table Storage repo; without it that one test skips and says so.

`pnpm run dev` starts Azurite and the site on http://localhost:4280. `/login` opens the SWA CLI's
fake sign-in: enter any name and add the role `admin` to reach `/admin.html`. Nothing here touches
Azure, and no email is sent (`EMAIL_LIVE=off`; captured messages appear in the API log).

## 8. Claude Code

Open Claude Code in the repo once. The `SessionStart` hook creates `.claude/sessions.csv` (gitignored)
and a `worklog` branch that persists it. `bash .claude/hooks/session-log.sh report` shows the hours
ledger. `.claude/settings.local.json` is per-machine and stays uncommitted. There is no `.mcp.json`
on purpose (see `DECISIONS.md`).
