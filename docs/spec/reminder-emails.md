# Reminder emails

_Status: built; not yet deployed. No email is sent anywhere until `EMAIL_LIVE=on` is set in Azure
after the sender domain is verified._

## The week

Games are on Saturday. The timer runs every day at 14:00 UTC and decides what the day calls for in
the team's time zone (`TIMEZONE`):

| Day | Email | To | Once per |
|---|---|---|---|
| Any | **Confirmation** — right after a sign-up. Sent by the web API. | every parent email on the team list for the chosen player | sign-up |
| Monday | **Snack reminder** — "X's family is on snacks this week". | every parent email on the team list for the claimed player, read that morning | claim (`reminded_at`) |
| Monday | **Coach nudge** — a game this week has nobody. Only when `COACH_EMAIL` is set. | the coach | run |
| Thursday | **Team reminder** — "game this Saturday vs …", naming the player whose family has snacks. | every distinct parent email across the team list; one email each | game (`team_reminded_at`) |

Every email is plain text, from `EMAIL_FROM` on the verified domain, with the site URL at the end.

## The team list

The coach keeps it on the admin page ("Team List"): one line per player, `Player Name,
mom@example.com, dad@example.com` (up to four addresses); re-adding a player replaces their
addresses; Remove takes a player off. Stored in the
`roster` table, one row per player, never shown outside the admin page. It is also what the public
sign-up picker offers (names only), so an empty list means nobody can sign up and Thursday's
email goes to nobody; the admin page says so. Two players with the same parent email produce one
Thursday email, not two.

## Rules

- Each reminder goes out at most once per game. `reminded_at` (on the claim) and
  `team_reminded_at` (on the game) are the idempotency keys; the timer can run any number of times
  a day, on any day.
- Addresses are never copied onto a claim: each send looks the player up on the team list at
  that moment. A snack reminder counts as sent once any of the player's addresses accepts it;
  only if all of them fail is it left unmarked and retried next Monday. A claimed player who has
  been removed from the team list gets nothing and is logged as `reminder.no_recipient` so the
  coach can see it in Application Insights. For the team
  reminder, the game is marked sent after the whole list has been attempted: one bounced address
  must not re-send to everyone. Failures are logged as `team_reminder.failed`.
- Email is a secondary side effect everywhere: no primary action (a sign-up, a game edit) can fail
  because of it.
- Capture-vs-send: with `EMAIL_LIVE=off` (the default everywhere, including a fresh Azure deploy)
  every message is recorded in memory and logged as `email.captured`, never sent.

## Where it runs

`POST /api/jobs/reminders` in `apps/web`, guarded by a shared secret (`JOB_KEY`, header
`x-job-key`, constant-time compare). An Azure Logic App (Consumption) created by `infra/main.bicep`
calls it every day at 14:00 UTC with three retries. The endpoint is idempotent, so a retry or a
manual run never sends twice. There is no separate Function App: Static Web Apps Free has no timer
triggers, and the subscription has no Consumption-plan quota, so the schedule lives in the Logic
App and the run lives in the API. Thursday's sends go out in parallel to stay inside the Static Web
Apps API's 45-second request limit.

To run it by hand against a deployed app, see `docs/runbooks/first-deploy.md` ("Send a test run").
