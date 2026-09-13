/*
 * Reading the league's schedule PDF so the coach never types a season in by hand. The PDF (from
 * the club's registration system) has a text layer with one line per game:
 *
 *   09/19/2026 11:50AM Manchester City versus Chelsea ZH - Monger Park - U10 Field
 *
 * This module is the pure half: text in, games out. Extracting the text from the PDF bytes is the
 * API's job (apps/web/api/src/lib/schedule-pdf.ts). The quiet failures here: a 1:00PM kickoff read
 * as 01:00, an away game listing the opponent first, a line that is almost a game silently dropped.
 * Anything that looks like a game line but does not parse is returned in `skipped` for the coach
 * to see, never swallowed.
 */
import { gameIdFor } from "./snacks.js";
import type { NewGameInput } from "./schemas.js";

export interface ParsedSchedule {
  games: NewGameInput[];
  skipped: string[];
}

// 09/19/2026  11:50AM  Manchester City versus Chelsea  <anything: location>
const GAME_LINE =
  /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)\s+(.+?)\s+versus\s+(.+)$/i;
// A line that starts with a date is a game row, whatever else it holds.
const LOOKS_LIKE_GAME = /^\d{1,2}\/\d{1,2}\/\d{4}\b/;

function to24h(hour: number, minute: number, meridiem: string): string {
  const h = (hour % 12) + (meridiem.toUpperCase() === "PM" ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Pick the opponent out of "X versus Y": whichever side is not us. If neither side is the team
 * (a renamed team, a typo in the PDF), the side after "versus" is used and the caller sees no
 * difference — so the team name is matched loosely, case-insensitively, on a prefix.
 */
function opponentOf(left: string, right: string, teamName: string): string {
  const us = teamName.trim().toLowerCase();
  const l = left.trim().toLowerCase();
  const r = right.trim().toLowerCase();
  if (l.startsWith(us) && !r.startsWith(us)) return right.trim();
  if (r.startsWith(us) && !l.startsWith(us)) return left.trim();
  return right.trim();
}

/**
 * The right-hand side of "versus" carries the opponent followed by the location column, with only
 * whitespace between them. The location in this league always starts with a site code like
 * "ZH - "; strip from the first " - "-bearing token onwards. Falls back to the whole string.
 */
function stripLocation(rest: string): string {
  const m = /^(.*?)\s+\S+\s+-\s+/.exec(rest);
  return (m?.[1] ?? rest).trim();
}

export function parseScheduleText(text: string, teamName: string): ParsedSchedule {
  const games = new Map<string, NewGameInput>();
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!LOOKS_LIKE_GAME.test(line)) continue;
    const m = GAME_LINE.exec(line);
    if (!m) {
      skipped.push(line);
      continue;
    }
    const [, mm, dd, yyyy, hh, min, ampm, left, rightWithLocation] = m as unknown as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    const opponent = opponentOf(left, stripLocation(rightWithLocation), teamName);
    const date = `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    if (Number.isNaN(Date.parse(date)) || !opponent) {
      skipped.push(line);
      continue;
    }
    const game: NewGameInput = { date, kickoff: to24h(Number(hh), Number(min), ampm), opponent };
    games.set(gameIdFor(game), game); // a duplicated row in the PDF is one game
  }
  return { games: [...games.values()].sort((a, b) => a.date.localeCompare(b.date)), skipped };
}
