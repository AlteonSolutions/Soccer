/*
 * The snack sign-up rules, as pure functions of (games, claims, now). No storage, no HTTP, no
 * email client: everything here is called from route handlers and the reminder timer and is
 * tested directly. The quiet failures live here — a parent's email leaking into the public view,
 * a reminder going out twice, a claim accepted for a game already played.
 */
import type { Claim, Game, NewGameInput, PublicGame } from "./schemas.js";

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

/** The public schedule: every game with the claimant's name and nothing else from the claim. */
export function toPublicSchedule(games: readonly Game[], claims: readonly Claim[]): PublicGame[] {
  const byGame = new Map(claims.map((c) => [c.game_id, c]));
  return sortByDate(games).map((game) => ({
    ...game,
    snack_by: byGame.get(game.id)?.parent_name ?? null,
  }));
}

export interface ReminderDue {
  game: Game;
  claim: Claim;
}

/**
 * Claims that need a reminder today: the game is between today and `daysAhead` days out
 * inclusive, and no reminder has gone out yet. `reminded_at` is the idempotency key — the timer
 * runs daily and must never send twice.
 */
export function selectRemindersDue(
  games: readonly Game[],
  claims: readonly Claim[],
  today: string,
  daysAhead: number,
): ReminderDue[] {
  const horizon = addDays(today, daysAhead);
  const byId = new Map(games.map((g) => [g.id, g]));
  const due: ReminderDue[] = [];
  for (const claim of claims) {
    const game = byId.get(claim.game_id);
    if (!game || claim.reminded_at !== null) continue;
    if (game.date >= today && game.date <= horizon) due.push({ game, claim });
  }
  return due.sort((a, b) => a.game.date.localeCompare(b.game.date));
}

/** Upcoming games inside the window that nobody has signed up for — the coach's nudge. */
export function selectUnclaimed(
  games: readonly Game[],
  claims: readonly Claim[],
  today: string,
  daysAhead: number,
): Game[] {
  const horizon = addDays(today, daysAhead);
  const claimed = new Set(claims.map((c) => c.game_id));
  return sortByDate(
    games.filter((g) => !claimed.has(g.id) && g.date >= today && g.date <= horizon),
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
      `Hi ${claim.parent_name},\n\n` +
      `Thanks for signing up to bring snacks for the ${teamName} game on ${describeGame(game)}.\n` +
      (game.notes ? `\nNotes from the coach: ${game.notes}\n` : "") +
      `\nWe'll send one reminder a couple of days before. If plans change, let the coach know.\n\n` +
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
    subject: `${teamName}: snack reminder for ${game.date}`,
    text:
      `Hi ${claim.parent_name},\n\n` +
      `Quick reminder: you're bringing snacks for the ${teamName} game on ${describeGame(game)}.\n` +
      (game.notes ? `\nNotes from the coach: ${game.notes}\n` : "") +
      `\nThank you!\n\nSchedule: ${siteUrl}\n`,
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
