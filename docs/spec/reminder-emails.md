# Reminder emails

_Status: deployed. The sender domain `alteonapps.com` verified 2026-09-15; `EMAIL_LIVE=on` and
the custom sender are set by the same infrastructure deploy (runbook steps 7–8)._

## The week

Games are on Saturday. The timer runs every day at 14:00 UTC and decides what the day calls for in
the team's time zone (`TIMEZONE`):

| Day | Email | Default To / BCC | Once per |
|---|---|---|---|
| Any | **Confirmation** — right after a sign-up. Sent by the web API. | To `{{parents}}`: every parent email on the team list for the chosen player | sign-up |
| Monday | **Snack reminder** — "X's family is on snacks this week", with the allergy reminder when set. | To `{{parents}}`, read that morning | claim (`reminded_at`) |
| Monday | **Coach nudge** — a game this week has nobody. Sent only when it resolves to somebody. | To `{{coach}}` | run |
| Thursday | **Team reminder** — "game this Saturday vs …", naming the player whose family has snacks. | To `{{coach}}`, BCC `{{team_parents}}`: every distinct parent email across the team list | game (`team_reminded_at`) |

The To and BCC lines are part of each template and the coach edits them on the admin page. A line
is a comma-separated mix of `{{parents}}` (the parents of the player the email is about),
`{{team_parents}}` (every address on the team list, once), `{{coach}}` (the coach email from
Site Settings, else `COACH_EMAIL`, else nobody) and plain addresses. Addresses are de-duplicated
and anyone in To is dropped from BCC. The team goes in BCC by default so no family sees another's
address; the coach can move it to To knowingly. A template must name somebody in To or BCC; an
email whose lines resolve to nobody at send time is logged and skipped (a Monday reminder is then
retried the following Monday). Azure Communication Services takes at most 50 recipients per
message, so a longer list goes out as several messages: the first with To and the first BCCs,
the rest BCC only.

Every email is plain text, from `EMAIL_FROM` on the verified domain, with the site URL at the end.

## Templates

The subject and body of all four emails are templates the coach edits on the admin page ("Email
Templates"), stored with the site settings. `{{placeholders}}` are filled when the email is sent:
`team`, `game` ("9/19 at 10:00 AM vs Red Dragons"), `date` ("9/19"), `kickoff` ("10:00 AM"),
`opponent`, `site_url`, plus `allergies` (snack reminder: "A reminder that we have peanut and
tree nut food allergies on the team – please plan snacks around them.", or nothing when the coach
has set none; a blank line left behind collapses), plus
`player` (confirmation, snack reminder), `snacks` (team reminder: "Snacks: Leo Rivera." or that the
slot is open) and `count`/`games` (coach nudge). A placeholder the email does not know stays in the
text as written, so a typo is visible rather than silent. The defaults live in
`packages/shared/src/templates.ts`; "Reset To Default" restores them. "Preview" renders the
template as typed through the same builders that send the real emails, filled from the next game
on the schedule and the family signed up for it (or the first player on the team list, or a
sample game when the schedule is empty), so the coach sees the exact email before saving. The team name in every
email is the one from the settings, not `TEAM_NAME`.

## The team list

The coach keeps it on the admin page ("Team List"): one line per player, `Player Name,
mom@example.com, dad@example.com` (up to four addresses); re-adding a player replaces their
addresses; Remove takes a player off. Stored in the
`roster` table, one row per player, never shown outside the admin page. It is also what the public
sign-up picker offers (names only), so an empty list means nobody can sign up and Thursday's
email goes to nobody; the admin page says so. Two players with the same parent email get one
Thursday copy, not two.

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
