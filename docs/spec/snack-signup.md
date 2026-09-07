# Snack sign-up

_Status: built in the first app commit; not yet deployed._

## Who and what

Parents of the team see the season's games and sign up to bring snacks for one. The coach adds and
removes games and sees who signed up. There are no parent accounts: the site is public, and a
sign-up asks for a name and an email address.

## Rules

- One family per game. The first sign-up wins; a second attempt is told "Someone else just signed
  up for this game" and the page refreshes to show who.
- A sign-up needs a name (1–60 characters) and a valid email address. Both are validated on the
  server; the browser's validation is a convenience, not the guard.
- Games already played cannot be signed up for. "Today" is decided in the team's time zone
  (`TIMEZONE`), not UTC.
- The public page shows the parent's **name** next to the game. The **email address is never
  rendered on the public page or returned by the public API**, and `publicGameSchema` is typed so
  it cannot carry one. Only the coach, signed in with the `admin` role, sees emails.
- A sign-up sends one confirmation email to the parent. If that email fails, the sign-up still
  stands; the failure is logged and the response says `confirmation_sent: false`.
- Parents cannot cancel their own sign-up (there is no account to prove it is theirs). They tell
  the coach, who releases the slot from the admin page.
- Removing a game removes its sign-up too, so a reminder can never go out for a cancelled game.

## Screens

- `/` — the schedule. Title Case headings. Each game: date, kickoff, opponent, location, notes,
  and either "_Name_ is bringing snacks" or a **Sign Up** button that opens an inline form.
- `/admin.html` — the coach's page, behind Static Web Apps sign-in with the `admin` role. Add A
  Game; the table of games with sign-ups and emails; Release Slot; Remove Game.
- `/login`, `/logout` — redirects to the SWA auth endpoints.

## API

| Method and path | Who | Body / result |
|---|---|---|
| `GET /api/games` | anyone | `{ team_name, games: PublicGame[] }` |
| `POST /api/claims` | anyone | `ClaimInput` → `201 { game: PublicGame, confirmation_sent }` |
| `GET /api/admin/games` | admin | `{ games: AdminGame[] }` (emails included) |
| `POST /api/admin/games` | admin | `NewGameInput` → `201 Game` |
| `DELETE /api/admin/games/{id}` | admin | `204` |
| `DELETE /api/admin/claims/{gameId}` | admin | `204` |

Errors are `{ error: { code, message } }` with the codes in `packages/shared/src/errors.ts`.
Admin routes are gated twice: SWA route rules (`staticwebapp.config.json`) and `requireAdmin` in
the API, so a misconfigured rule cannot expose emails.

## Data

Two Table Storage tables. `games`: partition `game`, row key = game id (`YYYY-MM-DD-opponent-slug`).
`claims`: partition `claim`, row key = game id, which is what enforces one sign-up per game.
