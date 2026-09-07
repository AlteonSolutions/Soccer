/*
 * Parsing the coach's pasted team list, kept free of the DOM so it is tested directly. The quiet
 * failure: a name with a comma in it ("Rivera, Ana") swallowed as an email, or a second parent's
 * address dropped.
 */

/**
 * "Leo Rivera, rivera@example.com, other@example.com" per line. Every comma-separated piece
 * containing "@" is an email; everything before the first email is the player's name.
 */
export function parseRosterLines(raw: string): { player: string; emails: string[] }[] {
  const out: { player: string; emails: string[] }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const pieces = line.split(",").map((piece) => piece.trim());
    const firstEmail = pieces.findIndex((piece) => piece.includes("@"));
    if (firstEmail < 1) continue; // no email, or an email with no name before it
    const player = pieces.slice(0, firstEmail).join(", ");
    const emails = pieces.slice(firstEmail).filter((piece) => piece.includes("@"));
    if (player && emails.length > 0) out.push({ player, emails });
  }
  return out;
}
