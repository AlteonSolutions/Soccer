/*
 * The schedule import, in two steps so a bad parse never overwrites the season silently: preview
 * (what the PDF says, and what importing would change) then import (write exactly those games).
 * A game is identified by date and opponent, so re-importing a corrected PDF updates kickoffs in
 * place, keeps every sign-up, and never re-sends the Thursday email for a game already announced.
 */
import {
  gameIdFor,
  type DataRepo,
  type Game,
  type ImportPreview,
  type ImportPreviewRow,
  type NewGameInput,
  type ParsedRoster,
  type ParsedSchedule,
  type RosterImportPreview,
  type RosterPreviewRow,
} from "@soccer/shared";

export async function previewImport(
  repo: DataRepo,
  parsed: ParsedSchedule,
): Promise<ImportPreview> {
  const existing = new Map((await repo.listGames()).map((g) => [g.id, g]));
  const games: ImportPreviewRow[] = parsed.games.map((game) => {
    const id = gameIdFor(game);
    const current = existing.get(id);
    const status = !current ? "new" : current.kickoff === game.kickoff ? "unchanged" : "changed";
    return { ...game, id, status };
  });
  return { games, skipped: parsed.skipped };
}

/** Upsert each game; an existing game keeps its team_reminded_at so Thursday's email is not repeated. */
export async function importGames(repo: DataRepo, games: readonly NewGameInput[]): Promise<Game[]> {
  const existing = new Map((await repo.listGames()).map((g) => [g.id, g]));
  const written: Game[] = [];
  for (const input of games) {
    const id = gameIdFor(input);
    const game: Game = {
      id,
      ...input,
      team_reminded_at: existing.get(id)?.team_reminded_at ?? null,
    };
    await repo.putGame(game);
    written.push(game);
  }
  return written;
}

/** The roster preview: each parsed player against the team list, by name, case-insensitively. */
export async function previewRosterImport(
  repo: DataRepo,
  parsed: ParsedRoster,
): Promise<RosterImportPreview> {
  const key = (p: string) => p.trim().toLowerCase();
  const existing = new Map((await repo.listRoster()).map((m) => [key(m.player), m]));
  const members: RosterPreviewRow[] = parsed.members.map((m) => {
    const current = existing.get(key(m.player));
    const same = current && [...current.emails].sort().join() === [...m.emails].sort().join();
    return { ...m, status: !current ? "new" : same ? "unchanged" : "changed" };
  });
  return { members, no_email: parsed.no_email, truncated: parsed.truncated };
}
