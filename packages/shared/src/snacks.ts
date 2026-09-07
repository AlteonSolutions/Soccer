/*
 * The snack sign-up and reminder rules, as pure functions of (games, claims, roster, today). No
 * storage, no HTTP, no email client: everything here is called from route handlers and the
 * reminder timer and is tested directly. The quiet failures live here — a parent's email leaking
 * into the public view, a reminder going out twice, a claim accepted for a game already played.
 *
 * The week, as the coach described it: games are on Saturday. Monday, the family on snacks gets
 * a reminder. Thursday, the whole roster gets a reminder about Saturday's game.
 */
import type { Claim, Game, NewGameInput, PublicGame, RosterMember } from "./schemas.js";

/** Calendar date (YYYY-MM-DD) of `now` in the team's time zone, not in UTC. */
export function localDateIso(now: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD; the other locales do not.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Add `days` to a YYYY-MM-DD string without touching time zones. */
export function addDays(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a YYYY-MM-DD string, independent of the machine's zone. */
export function weekdayOf(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Monday: the family on snacks has the working week to shop.
export const SNACK_REMINDER_WEEKDAY = 1;
// Thursday: two days' notice for a Saturday game, late enough that plans are real.
export const TEAM_REMINDER_WEEKDAY = 4;
// Monday's window reaches the coming Saturday and Sunday (6 days), so a Sunday game is covered too.
const SNACK_WINDOW_DAYS = 6;
// Thursday's window reaches Sunday (3 days) for the same reason.
const TEAM_WINDOW_DAYS = 3;

/** A URL-safe id from the game date and opponent: "2026-09-13-red-dragons". */
export function gameIdFor(input: Pick<NewGameInput, "date" | "opponent">): string {
  const slug = input.opponent
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${input.date}-${slug || "game"}`;
}

export function isPastGame(game: Pick<Game, "date">, today: string): boolean {
  return game.date < today;
}

export function sortByDate<T extends Pick<Game, "date" | "kickoff">>(games: readonly T[]): T[] {
  return [...games].sort((a, b) =>
    `${a.date}T${a.kickoff}`.localeCompare(`${b.date}T${b.kickoff}`),
  );
}

/** The public schedule: every game with the player whose family has snacks, nothing else from the claim. */
export function toPublicSchedule(games: readonly Game[], claims: readonly Claim[]): PublicGame[] {
  const byGame = new Map(claims.map((c) => [c.game_id, c]));
  // Explicit columns: a new field on Game (like team_reminded_at) stays private until named here.
  return sortByDate(games).map((game) => ({
    id: game.id,
    date: game.date,
    kickoff: game.kickoff,
    opponent: game.opponent,
    location: game.location,
    snack_by: byGame.get(game.id)?.player ?? null,
  }));
}

/** Player names for the sign-up picker, sorted, and nothing else from the roster. */
export function toPlayerNames(roster: readonly RosterMember[]): string[] {
  return roster.map((m) => m.player).sort((a, b) => a.localeCompare(b));
}

/** The addresses for one player, looked up on the team list at send time; [] if they left the team. */
export function emailsForPlayer(roster: readonly RosterMember[], player: string): string[] {
  const key = player.trim().toLowerCase();
  return roster.find((m) => m.player.trim().toLowerCase() === key)?.emails ?? [];
}

/** Thursday's recipients: one email per address, however many players share a parent. */
export function rosterEmails(roster: readonly RosterMember[]): string[] {
  return [...new Set(roster.flatMap((m) => m.emails))].sort();
}

function inWindow(game: Pick<Game, "date">, today: string, days: number): boolean {
  return game.date >= today && game.date <= addDays(today, days);
}

export interface SnackReminderDue {
  game: Game;
  claim: Claim;
}

/**
 * Monday's list: claims for games in the coming week that have not been reminded. `reminded_at`
 * is the idempotency key — the timer runs daily and must never send twice.
 */
export function selectSnackReminders(
  games: readonly Game[],
  claims: readonly Claim[],
  today: string,
): SnackReminderDue[] {
  const byId = new Map(games.map((g) => [g.id, g]));
  const due: SnackReminderDue[] = [];
  for (const claim of claims) {
    const game = byId.get(claim.game_id);
    if (game && claim.reminded_at === null && inWindow(game, today, SNACK_WINDOW_DAYS))
      due.push({ game, claim });
  }
  return due.sort((a, b) => a.game.date.localeCompare(b.game.date));
}

/** Thursday's list: games this weekend the whole team has not been told about yet. */
export function selectTeamReminders(games: readonly Game[], today: string): Game[] {
  return sortByDate(
    games.filter((g) => g.team_reminded_at === null && inWindow(g, today, TEAM_WINDOW_DAYS)),
  );
}

/** Games in the coming week that nobody has signed up for — the coach's Monday nudge. */
export function selectUnclaimed(
  games: readonly Game[],
  claims: readonly Claim[],
  today: string,
): Game[] {
  const claimed = new Set(claims.map((c) => c.game_id));
  return sortByDate(
    games.filter((g) => !claimed.has(g.id) && inWindow(g, today, SNACK_WINDOW_DAYS)),
  );
}

export interface EmailCopy {
  subject: string;
  text: string;
}

export function describeGame(game: Game): string {
  return `${game.date} at ${game.kickoff} vs ${game.opponent}, ${game.location}`;
}

export function confirmationEmail(
  game: Game,
  claim: Claim,
  teamName: string,
  siteUrl: string,
): EmailCopy {
  return {
    subject: `${teamName}: you're on snacks for ${game.date}`,
    text:
      `Hi,\n\n` +
      `${claim.player}'s family is signed up to bring snacks for the ${teamName} game on ${describeGame(game)}.\n\n` +
      `We'll send one reminder on the Monday before. If plans change, let the coach know.\n\n` +
      `Schedule: ${siteUrl}\n`,
  };
}

export function reminderEmail(
  game: Game,
  claim: Claim,
  teamName: string,
  siteUrl: string,
): EmailCopy {
  return {
    subject: `${teamName}: snacks this week — ${game.date}`,
    text:
      `Hi,\n\n` +
      `Quick reminder: ${claim.player}'s family is bringing snacks for the ${teamName} game on ${describeGame(game)}.\n\n` +
      `Thank you!\n\nSchedule: ${siteUrl}\n`,
  };
}

/** Thursday's note to every family. Names the player whose family has snacks; never an email. */
export function teamReminderEmail(
  game: Game,
  claim: Claim | undefined,
  teamName: string,
  siteUrl: string,
): EmailCopy {
  const snacks = claim
    ? `Snacks: ${claim.player}'s family.`
    : `Snacks: nobody has signed up yet — grab the slot at ${siteUrl}`;
  return {
    subject: `${teamName}: game this Saturday vs ${game.opponent}`,
    text:
      `Hi ${teamName} families,\n\n` +
      `Reminder: game on ${describeGame(game)}.\n\n` +
      `${snacks}\n\n` +
      `See you there!\n\nSchedule: ${siteUrl}\n`,
  };
}

export function unclaimedNudgeEmail(
  games: readonly Game[],
  teamName: string,
  siteUrl: string,
): EmailCopy {
  const list = games.map((g) => `  - ${describeGame(g)}`).join("\n");
  return {
    subject: `${teamName}: ${games.length} upcoming game${games.length === 1 ? "" : "s"} with no snack sign-up`,
    text: `Nobody has signed up for snacks yet for:\n\n${list}\n\nSchedule: ${siteUrl}\n`,
  };
}
