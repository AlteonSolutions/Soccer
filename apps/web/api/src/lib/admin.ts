/*
 * What the coach can do: manage games, see every claim with its email, release a slot. Every
 * function here is reached only through a route that has passed `requireAdmin`.
 */
import {
  gameIdFor,
  sortByDate,
  type AdminGame,
  type DataRepo,
  type Game,
  type NewGameInput,
} from "@soccer/shared";

export async function listAdminGames(repo: DataRepo): Promise<AdminGame[]> {
  const [games, claims] = await Promise.all([repo.listGames(), repo.listClaims()]);
  const byGame = new Map(claims.map((c) => [c.game_id, c]));
  return sortByDate(games).map((game) => ({ ...game, claim: byGame.get(game.id) ?? null }));
}

export async function addGame(repo: DataRepo, input: NewGameInput): Promise<Game> {
  const game: Game = { id: gameIdFor(input), ...input };
  await repo.putGame(game);
  return game;
}

/** Removing a game also removes its claim, so a reminder can never go out for a cancelled game. */
export async function removeGame(repo: DataRepo, id: string): Promise<void> {
  await repo.deleteClaim(id);
  await repo.deleteGame(id);
}

export async function releaseClaim(repo: DataRepo, gameId: string): Promise<void> {
  await repo.deleteClaim(gameId);
}
