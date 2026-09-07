/*
 * An in-memory `DataRepo` with the same contract as the Table Storage one, including the
 * one-claim-per-game conflict. Tests use it so the pure logic in `lib/` and the route handlers
 * can be exercised without Azurite. It is deliberately *not* unified with `data.ts`: the two share
 * an interface, not code, so a bug in the emulator double cannot hide a bug in the real repo.
 */
import { AppError } from "./errors.js";
import type { DataRepo } from "./data.js";
import type { Claim, Game } from "./schemas.js";

export function createMemoryRepo(seed: { games?: Game[]; claims?: Claim[] } = {}): DataRepo {
  const games = new Map((seed.games ?? []).map((g) => [g.id, g]));
  const claims = new Map((seed.claims ?? []).map((c) => [c.game_id, c]));
  return {
    async listGames() {
      return [...games.values()];
    },
    async getGame(id) {
      return games.get(id);
    },
    async putGame(game) {
      games.set(game.id, game);
    },
    async deleteGame(id) {
      games.delete(id);
    },
    async listClaims() {
      return [...claims.values()];
    },
    async getClaim(gameId) {
      return claims.get(gameId);
    },
    async createClaim(claim) {
      if (claims.has(claim.game_id)) {
        throw new AppError(
          "ALREADY_CLAIMED",
          "Someone else just signed up for this game.",
          "Two parents raced for one slot; the first write won. No action needed.",
        );
      }
      claims.set(claim.game_id, claim);
    },
    async deleteClaim(gameId) {
      claims.delete(gameId);
    },
    async markReminded(gameId, at) {
      const existing = claims.get(gameId);
      if (existing) claims.set(gameId, { ...existing, reminded_at: at });
    },
  };
}
