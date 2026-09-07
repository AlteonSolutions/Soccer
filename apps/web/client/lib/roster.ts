/*
 * Parsing the coach's pasted team list, kept free of the DOM so it is tested directly. The quiet
 * failure: a name with a comma in it ("Rivera, Ana") split on the first comma instead of the last.
 */

/** "Leo Rivera, rivera@example.com" per line; the last comma splits name from email. */
export function parseRosterLines(raw: string): { player: string; email: string }[] {
  const out: { player: string; email: string }[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const at = line.lastIndexOf(",");
    if (at < 0) continue;
    const player = line.slice(0, at).trim();
    const email = line.slice(at + 1).trim();
    if (player && email) out.push({ player, email });
  }
  return out;
}
