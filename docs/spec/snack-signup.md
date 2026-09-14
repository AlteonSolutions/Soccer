# Snack sign-up

_Status: built in the first app commit; not yet deployed._

## Who and what

Parents of the team see the season's games and sign up to bring snacks for one. The coach adds and
removes games, keeps the team list (player name plus one or more parent emails), and sees who
signed up. There
are no parent accounts: the site is public, and a sign-up is picking the player from the team list
and confirming. No email is typed anywhere on the public site.

## The schedule

The coach uploads the league's schedule PDF on the admin page ("Import The Schedule"). The API
reads its text layer (`unpdf`, pure JavaScript, bundled into the Functions app) and
`parseScheduleText` in `packages/shared` turns lines like
`09/19/2026 11:50AM Manchester City versus Chelsea ZH - Monger Park - U10 Field` into games:
date, kickoff (24-hour), opponent (whichever side of "versus" is not us). Location is dropped: every
game is at the same field. The page shows a preview — Add, Update Kickoff, or Keep As Is per game,
plus any date-shaped line that could not be read — and nothing is written until the coach clicks
Import. A game's id is its date and opponent, so re-importing a corrected PDF updates kickoffs in
place, keeps every sign-up, and never re-sends the Thursday email for a game already announced.
The one-game form stays for corrections the league never issues a PDF for, and every row in the
schedule table has Edit: date, kickoff and opponent inline, Save or Cancel. A game's id is its date
and opponent, so editing either moves the sign-up onto the new id; an edit that would collide with
another game is refused.

The team list comes from the league's roster PDF the same way ("Read Roster PDF" → preview →
Import): one block per player, name before the "(M)"/"(F)" marker the league prints, every email
in the block (the second parent is on a continuation line). Parent names and phones are not
kept — the school and the first parent's name run together, and nothing uses a parent's name. A
player with no email in the PDF is listed in the preview for the coach to add by hand; more than
four addresses keeps the first four and says so. The paste box remains for those and for
mid-season additions. Players keep the order the roster PDF lists them in (each member carries a
`position`; hand-added players go to the end), so the admin page and the sign-up picker read like
the league's roster. Each player has Edit: name and emails inline, Save or Cancel. Renaming a
player moves their sign-ups to the new name; a rename that collides with another player is refused.

The league's PDF carries the coaches' phone numbers and emails, so it is never committed; the test
fixture is a PDF printed from HTML in the same layout with made-up people.

## Rules

- One family per game. The first sign-up wins; a second attempt is told "Someone else just signed
  up for this game" and the page refreshes to show who.
- A sign-up names a player. The server checks the player is on the team list (case-insensitive);
  a name not on the list is rejected. The claim stores the player only. Every email — the
  confirmation, Monday's reminder, Thursday's reminder — reads the addresses from the team list
  at the moment it is sent, so correcting a parent's email on the admin page takes effect for
  every future email at once. The browser only
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

- `/` — the schedule. Title Case headings. Each game: date, kickoff, opponent,
  and either "Snacks: _Player_" or a **Sign Up** button that opens the picker and confirm step.
- `/admin/` — the coach's page, behind Static Web Apps sign-in with the `admin` role. Two cards:
  the Schedule (games with sign-ups and emails; a three-dots menu per row with Edit, Release Slot,
  Remove Game) and the Team List
  (one line per player in roster order: name, then up to four parent emails, with Edit and Remove;
  re-adding a player replaces their emails). Under each card's heading, above its list, is a panel
  that is collapsed by default: Import Or Add Games (PDF upload, preview, import; Add A Game) and
  Import Or Add Players (roster PDF upload, preview, import; add by hand).
- `/login`, `/logout` — redirects to the SWA auth endpoints.

## API

| Method and path | Who | Body / result |
|---|---|---|
| `GET /api/games` | anyone | `{ team_name, games: PublicGame[], players: string[] }` |
| `POST /api/claims` | anyone | `{ game_id, player }` → `201 { game: PublicGame, confirmation_sent }` |
| `GET /api/coach/games` | admin | `{ games: AdminGame[] }` (emails included) |
| `POST /api/coach/games` | admin | `NewGameInput` → `201 Game` |
| `POST /api/coach/schedule/parse` | admin | PDF bytes (≤5 MB) → `ImportPreview` (no write) |
| `POST /api/coach/games/bulk` | admin | `{ games: NewGameInput[] }` (≤60) → `201 { imported }` |
| `PUT /api/coach/games/{id}` | admin | `NewGameInput` → `200 Game` (moves the sign-up if the id changes) |
| `POST /api/coach/roster/parse` | admin | PDF bytes (≤5 MB) → `RosterImportPreview` (no write) |
| `DELETE /api/coach/games/{id}` | admin | `204` |
| `DELETE /api/coach/claims/{gameId}` | admin | `204` |
| `GET /api/coach/roster` | admin | `{ members: RosterMember[] }` |
| `POST /api/coach/roster` | admin | `{ members: [{ player, emails: string[1..4], position? }] }` (≤100) → `201 { members }` |
| `PUT /api/coach/roster/{player}` | admin | `{ player, emails }` → `200 RosterMember` (a rename moves the sign-ups) |
| `DELETE /api/coach/roster/{player}` | admin | `204` |
| `GET /api/coach/settings` | admin | `{ settings, default_templates, emails }` |
| `PUT /api/coach/settings` | admin | `SettingsInput` (team name, allergy note, templates) → `200` same shape |
| `POST /api/coach/settings/preview` | admin | `{ team_name, kind, template }` → `{ subject, text, based_on }` (renders as typed; writes nothing) |
| `POST /api/coach/logo` | admin | image bytes (≤2 MB, `image/*` content type) → `200 Settings` |
| `DELETE /api/coach/logo` | admin | back to the built-in badge → `200 Settings` |
| `GET /api/logo` | public | the uploaded badge, or 404 (the page then keeps `/logo.svg`) |

Errors are `{ error: { code, message } }` with the codes in `packages/shared/src/errors.ts`.
The admin **page** is gated by the SWA route rule `/admin/*`. The admin **API** is gated by
`requireAdmin`, which reads the `x-ms-client-principal` header that Static Web Apps sets from the
session on every request (a client-supplied value is replaced). An SWA role rule on `/api/coach/*`
was tried first and made those routes 404 for everyone, admin included; it is deliberately absent.

## Site settings

The coach edits, on the admin page: the **team name** (the heading on the sign-up page and the
`{{team}}` in every email), the **coach email** (where `{{coach}}` goes; empty falls back to
`COACH_EMAIL`), a comma-separated **food allergies** list, the
**team badge** (any image up to 2 MB; the header and tab icon on both pages), and the four
**email templates** (To, BCC, subject, body). `TEAM_NAME` in the environment is only the
fallback for a site with no
settings row yet. Above the games the sign-up page shows a thank-you line and one sentence with
the player count (always the length of the team list) and the allergies: "a peanut food
allergy", "peanut and tree nut food allergies", or "no food allergies".

## Data

Four Table Storage tables and one blob. `settings`: partition `settings`, row key `site`, one
row: team_name, coach_email, allergies, logo_updated_at, templates_json. The badge is the blob `assets/logo`
(an image does not fit a 64 KB table property); `logo_updated_at` versions its public URL so a
new upload is never served from cache. `roster`: partition `member`, row key = player name lower-cased (with
the four characters Table Storage forbids in keys mapped to `_`), columns player, emails_json,
added_at, position (the roster order; lists sort by it, then by name). Table Storage has no list column, so `emails` is a JSON string on disk and a `string[]`
everywhere else; only `data.ts` knows. `games`: partition `game`, row key = game id (`YYYY-MM-DD-opponent-slug`).
`claims`: partition `claim`, row key = game id, which is what enforces one sign-up per game;
columns player, created_at, reminded_at. No email is stored on a claim.
