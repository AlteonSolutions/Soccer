# Reminder emails

_Status: built; not yet deployed. No email is sent anywhere until `EMAIL_LIVE=on` is set in Azure
after the sender domain is verified._

## The week

Games are on Saturday. The timer runs every day at 14:00 UTC and decides what the day calls for in
the team's time zone (`TIMEZONE`):

| Day | Email | To | Once per |
|---|---|---|---|
| Any | **Confirmation** — right after a sign-up. Sent by the web API. | the parent who signed up | sign-up |
| Monday | **Snack reminder** — "you're on snacks this week". | the family signed up for a game Mon–Sun | claim (`reminded_at`) |
| Monday | **Coach nudge** — a game this week has nobody. Only when `COACH_EMAIL` is set. | the coach | run |
| Thursday | **Team reminder** — "game this Saturday vs …", with who has snacks (name only). | every address on the team email list, one email each | game (`team_reminded_at`) |

Every email is plain text, from `EMAIL_FROM` on the verified domain, with the site URL at the end.

## The team email list

The coach keeps it on the admin page ("Team Email List"): paste addresses, remove one. Stored in
the `roster` table, one row per email, never shown outside the admin page. Thursday's email goes to
each address separately, so no family sees another's address. An empty list means Thursday's
email goes to nobody; the admin page says so.

## Rules

- Each reminder goes out at most once per game. `reminded_at` (on the claim) and
  `team_reminded_at` (on the game) are the idempotency keys; the timer can run any number of times
  a day, on any day.
- A failed snack reminder is not marked sent, so it is retried on the next Monday run. For the team
  reminder, the game is marked sent after the whole list has been attempted: one bounced address
  must not re-send to everyone. Failures are logged as `team_reminder.failed`.
- Email is a secondary side effect everywhere: no primary action (a sign-up, a game edit) can fail
  because of it.
- Capture-vs-send: with `EMAIL_LIVE=off` (the default everywhere, including a fresh Azure deploy)
  every message is recorded in memory and logged as `email.captured`, never sent.

## Where it runs

`apps/reminders` is its own Azure Function App on the Consumption plan with one daily timer,
because Static Web Apps Free runs HTTP triggers only. It shares the storage account and the config
variables with the web API; the logic (`runReminders`) is tested with the in-memory repo and
captured email for a Monday, a Thursday, and an ordinary day.

To run it by hand against a deployed app, see `docs/runbooks/first-deploy.md` ("Send a test run").
