# Snack sign-up

_Status: built in the first app commit; not yet deployed._

## Who and what

Parents of the team see the season's games and sign up to bring snacks for one. The coach adds and
removes games, keeps the team list (player name plus one or more parent emails), and sees who
signed up. There
are no parent accounts: the site is public, and a sign-up is picking the player from the team list
and confirming. No email is typed anywhere on the public site.

## Rules

- One family per game. The first sign-up wins; a second attempt is told "Someone else just signed
  up for this game" and the page refreshes to show who.
- A sign-up names a player. The server looks the player up on the team list (case-insensitive)
  and copies every parent email onto the claim; a name not on the list is rejected. Emails added
  to the list later do not change an existing claim; Release Slot and re-sign-up does. The browser only
  offers names from the list and asks "Sign up X's family … ?" before submitting.
- We assume nobody signs up another family's player. The confirm step and the coach's Release
  Slot are the guard; a per-family secret link would be the next step if that assumption fails.
- Games already played cannot be signed up for. "Today" is decided in the team's time zone
  (`TIMEZONE`), not UTC.
- The public page shows the **player's name** next to the game and offers the team's player names
  in the picker. **No email address is ever rendered on the public page or returned by the public
  API**; `publicGameSchema` and `scheduleResponseSchema` are typed so they cannot carry one. Only
  the coach, signed in with the `admin` role, sees emails.
- A sign-up sends one confirmation email to the parent. If that email fails, the sign-up still
  stands; the failure is logged and the response says `confirmation_sent: false`.
- Parents cannot cancel their own sign-up (there is no account to prove it is theirs). They tell
  the coach, who releases the slot from the admin page.
- Removing a game removes its sign-up too, so a reminder can never go out for a cancelled game.

## Screens

Team colors (sky blue, navy, white) are the five variables at the top of `apps/web/client/styles.css`.
The header badge is `apps/web/client/logo.svg`, an original design in those colors: the club's real
crest is Manchester City FC's trademark and is not copied here. To use an official logo you are
licensed to use, replace that one file; nothing else references it by content.

- `/` — the schedule. Title Case headings. Each game: date, kickoff, opponent, location,
  and either "Snacks: _Player_" or a **Sign Up** button that opens the picker and confirm step.
- `/admin.html` — the coach's page, behind Static Web Apps sign-in with the `admin` role. Add A
  Game; the table of games with sign-ups and emails; Release Slot; Remove Game; the Team List
  (one line per player: name, then up to four parent emails; re-adding a player replaces them).
- `/login`, `/logout` — redirects to the SWA auth endpoints.

## API

| Method and path | Who | Body / result |
|---|---|---|
| `GET /api/games` | anyone | `{ team_name, games: PublicGame[], players: string[] }` |
| `POST /api/claims` | anyone | `{ game_id, player }` → `201 { game: PublicGame, confirmation_sent }` |
| `GET /api/admin/games` | admin | `{ games: AdminGame[] }` (emails included) |
| `POST /api/admin/games` | admin | `NewGameInput` → `201 Game` |
| `DELETE /api/admin/games/{id}` | admin | `204` |
| `DELETE /api/admin/claims/{gameId}` | admin | `204` |
| `GET /api/admin/roster` | admin | `{ members: RosterMember[] }` |
| `POST /api/admin/roster` | admin | `{ members: [{ player, emails: string[1..4] }] }` (≤100) → `201 { members }` |
| `DELETE /api/admin/roster/{player}` | admin | `204` |

Errors are `{ error: { code, message } }` with the codes in `packages/shared/src/errors.ts`.
Admin routes are gated twice: SWA route rules (`staticwebapp.config.json`) and `requireAdmin` in
the API, so a misconfigured rule cannot expose emails.

## Data

Three Table Storage tables. `roster`: partition `member`, row key = player name lower-cased (with
the four characters Table Storage forbids in keys mapped to `_`), columns player, emails_json,
added_at. Table Storage has no list column, so `emails` is a JSON string on disk and a `string[]`
everywhere else; only `data.ts` knows. `games`: partition `game`, row key = game id (`YYYY-MM-DD-opponent-slug`).
`claims`: partition `claim`, row key = game id, which is what enforces one sign-up per game;
columns player, emails_json (copied from the roster at sign-up), created_at, reminded_at.
