/*
 * What the coach can do: manage games, see every claim with its email, release a slot. Every
 * function here is reached only through a route that has passed `requireAdmin`.
 */
import {
  AppError,
  emailsForPlayer,
  gameIdFor,
  sortByDate,
  type AdminGame,
  type DataRepo,
  type Game,
  type NewGameInput,
  type RosterInput,
  type RosterMember,
} from "@soccer/shared";

export async function listAdminGames(repo: DataRepo): Promise<AdminGame[]> {
  const [games, claims, roster] = await Promise.all([
    repo.listGames(),
    repo.listClaims(),
    repo.listRoster(),
  ]);
  const byGame = new Map(claims.map((c) => [c.game_id, c]));
  return sortByDate(games).map((game) => {
    const claim = byGame.get(game.id) ?? null;
    return { ...game, claim, emails: claim ? emailsForPlayer(roster, claim.player) : [] };
  });
}

export async function addGame(repo: DataRepo, input: NewGameInput): Promise<Game> {
  const game: Game = { id: gameIdFor(input), ...input, team_reminded_at: null };
  await repo.putGame(game);
  return game;
}

/**
 * Edit a game. Its id is derived from date and opponent, so changing either changes the id: the
 * new game is written, the sign-up (keyed by game id) is moved onto it, and the old row deleted.
 * A kickoff-only edit keeps the id. The Thursday-announced mark is kept either way, so a corrected
 * time never re-sends the team email.
 */
export async function updateGame(repo: DataRepo, id: string, input: NewGameInput): Promise<Game> {
  const current = await repo.getGame(id);
  if (!current) {
    throw new AppError(
      "NOT_FOUND",
      "That game is no longer on the schedule.",
      "Edit of an unknown game id.",
    );
  }
  const next: Game = { id: gameIdFor(input), ...input, team_reminded_at: current.team_reminded_at };
  if (next.id === id) {
    await repo.putGame(next);
    return next;
  }
  if (await repo.getGame(next.id)) {
    throw new AppError(
      "VALIDATION",
      "There is already a game on that date against that opponent.",
      "Edit would collide with an existing game id; the coach should edit or remove that one instead.",
    );
  }
  const claim = await repo.getClaim(id);
  await repo.putGame(next);
  if (claim) {
    await repo.createClaim({ ...claim, game_id: next.id });
    await repo.deleteClaim(id);
  }
  await repo.deleteGame(id);
  return next;
}

/** Removing a game also removes its claim, so a reminder can never go out for a cancelled game. */
export async function removeGame(repo: DataRepo, id: string): Promise<void> {
  await repo.deleteClaim(id);
  await repo.deleteGame(id);
}

export async function releaseClaim(repo: DataRepo, gameId: string): Promise<void> {
  await repo.deleteClaim(gameId);
}

export async function listRoster(repo: DataRepo): Promise<RosterMember[]> {
  return (await repo.listRoster()).sort((a, b) => a.player.localeCompare(b.player));
}

/** Adds or corrects the pasted players; the last line wins when a player appears twice. */
export async function addRosterMembers(
  repo: DataRepo,
  input: RosterInput,
  now: Date,
): Promise<RosterMember[]> {
  await repo.addRosterMembers(input.members.map((m) => ({ ...m, added_at: now.toISOString() })));
  return listRoster(repo);
}

export async function removeRosterMember(repo: DataRepo, player: string): Promise<void> {
  await repo.removeRosterMember(player);
}
