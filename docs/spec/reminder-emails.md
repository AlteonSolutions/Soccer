# Reminder emails

_Status: built in the first app commit; not yet deployed. No email is sent anywhere until
`EMAIL_LIVE=on` is set in Azure after the sender domain is verified._

## What goes out

1. **Confirmation** — to the parent, immediately after a sign-up. Sent by the web API.
2. **Reminder** — to the parent, once, when the game is within `REMINDER_DAYS_AHEAD` days
   (default 2: one shopping day). Sent by the daily timer.
3. **Coach nudge** — to `COACH_EMAIL`, when a game inside the same window has no sign-up. Sent by
   the daily timer; disabled when `COACH_EMAIL` is empty.

Every email is plain text, from `EMAIL_FROM` on the verified domain, with the site URL at the end.

## Rules

- A reminder is sent at most once per sign-up. `reminded_at` on the claim is written right after
  a successful send and is the idempotency key; the timer can run any number of times a day.
- A failed reminder is not marked sent, so it is retried on the next run. One failure never stops
  the rest of the run.
- Email is a secondary side effect everywhere: no primary action (a sign-up, a game edit) can fail
  because of it.
- Capture-vs-send: with `EMAIL_LIVE=off` (the default everywhere, including a fresh Azure deploy)
  every message is recorded in memory and logged as `email.captured`, never sent.

## Where it runs

`apps/reminders` is its own Azure Function App on the Consumption plan with one timer trigger at
14:00 UTC daily, because Static Web Apps Free runs HTTP triggers only. It shares the storage
account and the config variables with the web API; the logic (`runReminders`) is tested with the
in-memory repo and captured email.

To run it by hand against a deployed app, see `docs/runbooks/first-deploy.md` ("Send a test run").
