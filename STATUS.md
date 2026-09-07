# Status

_Written to be read cold. Update it in the same commit as the change it describes._

## 2026-09-07 — First app built, not yet deployed

**What exists.** The whole first version, gated and tested, nothing in Azure yet.

- `apps/web` — the public schedule and sign-up page, the coach's admin page, and the HTTP API as
  Azure Functions. Built into `dist/` by esbuild and deployed as one Static Web App (Free tier).
- `apps/reminders` — a Consumption-plan Function App with one daily timer. Monday: reminder to
  the family on snacks this week, nudge to the coach if nobody is. Thursday: reminder about
  Saturday's game to every address on the coach-managed team email list.
- `packages/shared` — schemas, config, the Table Storage data guard (`withData()`), email behind
  the capture-vs-send flag, and the pure sign-up/reminder rules.
- `infra/main.bicep` — every Azure resource, at the lowest tier. **Not yet applied.**
- Specs: `docs/spec/snack-signup.md`, `docs/spec/reminder-emails.md`.

**What is verified.** `pnpm run gate` passes: typecheck of every package, lint, format, 47 tests.
The Table Storage repo round-trips against Azurite, roster included. Both Function Apps build to a
single file. The public and admin pages have been driven in headless Chromium against the real
client bundle and handler logic (in-memory storage) and screenshotted at desktop and phone width.

**What is not verified, and how it gets verified.**

- The Bicep has not been compiled or applied (no Azure CLI in the authoring environment). First
  run: `docs/runbooks/first-deploy.md` step 2. Expect to fix an API version or property name.
- The deploy workflow has never run (needs the secrets from that runbook, step 4).
- The web app has not been run end to end through the SWA CLI here (Azure Functions Core Tools not
  installed). `pnpm run dev` on a machine with `func` is the check.
- Whether SWA's built-in Entra sign-in accepts a personal Microsoft account for the coach; if not,
  the invitation in runbook step 6 still works with a work/school account, or add the `github`
  provider.
- `platform.apiRuntime: node:22` in `staticwebapp.config.json` is expected to be accepted by SWA.

**Next.**

1. Run the first-deploy runbook; fix whatever the Bicep needs; commit the fix with the first line of
   the file changed to say it is applied.
2. Add the custom domain and verify the email domain (runbook steps 7–8), then `EMAIL_LIVE=on`.
3. After the first real season data: decide whether parents need to release their own slot (would
   need a per-claim secret link in the confirmation email).
