/*
 * Reading the league's roster PDF so the coach never types the team list by hand. Its text layer
 * has one block per player: a line that starts with the player's name and an "(M)" or "(F)"
 * marker, then the school, then the first parent with phones and usually an email; a second
 * parent, when there is one, is on a continuation line with no marker:
 *
 *   Leo Example (M) Home Schooled Pat Example, 555-0100 (h), pat@example.com
 *   Sam Example, 555-0101 (h)
 *
 * We need two things from it: the player's name and every email in the block. Parent names are
 * not kept – the school and the first parent's name run together with nothing but a space between
 * them, so splitting them is guesswork, and nothing in the app uses a parent's name. Phones are
 * dropped. A player whose block has no email cannot be imported (a sign-up needs somewhere to send
 * the confirmation) and is reported, never silently skipped.
 */
import type { RosterInput } from "./schemas.js";

export interface ParsedRoster {
  members: RosterInput["members"];
  /** Players found with no email address; the coach adds them by hand with the parent's address. */
  no_email: string[];
  /** Players with more than the four addresses the app keeps; the first four were taken. */
  truncated: string[];
}

// "Leo Example (M) ..." – a name, then the gender marker the league prints and we ignore.
const PLAYER_LINE = /^(.+?)\s+\((?:M|F)\)\s/;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Two parents plus two more caregivers is the most any family has asked for (see schemas.ts).
const MAX_EMAILS = 4;

export function parseRosterText(text: string): ParsedRoster {
  const blocks: { player: string; lines: string[] }[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = PLAYER_LINE.exec(line);
    if (m?.[1]) {
      blocks.push({ player: m[1].trim(), lines: [line] });
    } else if (blocks.length > 0 && /\(h\)|\(c\)|\(w\)|@/.test(line)) {
      // A continuation line: a second parent's phones and email. Header lines never match.
      blocks[blocks.length - 1]!.lines.push(line);
    }
  }

  const members: RosterInput["members"] = [];
  const no_email: string[] = [];
  const truncated: string[] = [];
  for (const block of blocks) {
    const emails = [
      ...new Set(
        block.lines
          .join(" ")
          .match(EMAIL)
          ?.map((e) => e.toLowerCase()) ?? [],
      ),
    ];
    if (emails.length === 0) {
      no_email.push(block.player);
      continue;
    }
    if (emails.length > MAX_EMAILS) truncated.push(block.player);
    members.push({ player: block.player, emails: emails.slice(0, MAX_EMAILS) });
  }
  return { members, no_email, truncated };
}
