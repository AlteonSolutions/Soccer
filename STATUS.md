# Status

_Written to be read cold. Update it in the same commit as the change it describes._

## 2026-09-07 — First app built, not yet deployed

**What exists.** The whole first version, gated and tested, nothing in Azure yet.

- `apps/web` — the public schedule with pick-a-player sign-up (no email typed), the coach's admin
  page (schedule and roster import from the league's PDFs, inline game editing, team list), and the HTTP API as Azure Functions. Built into `dist/` by esbuild and deployed as one Static Web App (Free tier).
- The daily reminder run is `POST /api/jobs/reminders` in the web API, behind a shared key, called
  by a Logic App once a day. Monday: reminder to the family on snacks this week, nudge to the
  coach if nobody is. Thursday: reminder about Saturday's game to every address on the team list.
- `packages/shared` — schemas, config, the Table Storage data guard (`withData()`), email behind
  the capture-vs-send flag, and the pure sign-up/reminder rules.
- `infra/main.bicep` — every Azure resource, at the lowest tier. **Applied 2026-09-12** to `snaccer-rg`.
- Specs: `docs/spec/snack-signup.md`, `docs/spec/reminder-emails.md`.

**What is verified.** `pnpm run gate` passes: typecheck of every package, lint, format, 86 tests (89 with Azurite up).
The Table Storage repo round-trips against Azurite, roster, settings and the badge blob included. Both Function Apps build to a
single file. The public and admin pages have been driven in headless Chromium against the real
client bundle and handler logic (in-memory storage) and screenshotted at desktop and phone width.

**What is not verified, and how it gets verified.**

- The Logic App's daily call has not fired yet; the first Monday or Thursday run shows in
  Application Insights as `reminders.run`.
- The PDF import has been exercised against the coach's real league PDF locally and the fixture
  in tests, not yet on the live site.
- The web app has not been run end to end through the SWA CLI here (Azure Functions Core Tools not
  installed). `pnpm run dev` on a machine with `func` is the check.
- Whether SWA's built-in Entra sign-in accepts a personal Microsoft account for the coach; if not,
  the invitation in runbook step 6 still works with a work/school account, or add the `github`
  provider.
- `platform.apiRuntime: node:22` in `staticwebapp.config.json` is expected to be accepted by SWA.

**Go-live checklist** (target: https://signup.alteonapps.com, sender snacks@alteonapps.com).
Each item is a step in `docs/runbooks/first-deploy.md`.

- [x] Merge this branch to `main`.
- [x] Runbook 1–2: resource group `snaccer-rg`, Bicep applied 2026-09-12 (after two quota
      failures that turned the Function App into a Logic App, and one Logic App property fix).
- [x] Runbook 3–4: one secret and one variable in GitHub (2026-09-12).
- [x] Runbook 5: first deploy 2026-09-12 at lively-grass-0c651cf0f.5.azurestaticapps.net; coach
      invited as `admin`; team list and a game entered. Two platform quirks found and fixed on the
      way: an SWA role rule on `/api/admin/*` and the Functions host's reserved `admin/` route.
- [ ] Runbook 6: CNAME `signup` → the Static Web App; attach the hostname.
- [ ] Runbook 7: four DNS records for `alteonapps.com` email; verify; `linkCustomEmailDomain = true`.
- [ ] Runbook 8: `emailLive = 'on'`; sign up once yourself and receive the confirmation.

**After that.** Decide whether parents need to release their own slot (would need a per-claim
secret link in the confirmation email). Watch Application Insights the first Monday and Thursday.
