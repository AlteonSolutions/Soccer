import { connect } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withData } from "../src/data.js";
import { claim, game } from "./fixtures.js";

// Runs against Azurite's table endpoint when it is up (`pnpm run dev:storage`) and skips itself
// otherwise, so the gate passes on a fresh clone and still exercises the real repo where it can.
async function azuriteUp(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port: 10002 });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });
}

describe("withData against Azurite", async () => {
  const up = await azuriteUp();
  const run = up ? it : it.skip;
  const suffix = Date.now().toString(36);
  const testGame = game({ id: `2026-09-19-azurite-${suffix}` });
  const testClaim = claim({ game_id: testGame.id });

  beforeAll(() => {
    if (!up) console.info("Azurite not reachable on 127.0.0.1:10002; skipping Table Storage tests");
  });
  afterAll(async () => {
    if (!up) return;
    await withData(async (repo) => {
      await repo.deleteClaim(testGame.id);
      await repo.deleteGame(testGame.id);
    });
  });

  run(
    "round-trips a game and a claim, enforces one claim per game, and merges reminded_at",
    async () => {
      await withData((repo) => repo.putGame(testGame));
      expect(await withData((repo) => repo.getGame(testGame.id))).toEqual(testGame);

      await withData((repo) => repo.createClaim(testClaim));
      // A fresh claim has no reminded_at column in storage; it must read back as null, not fail.
      expect((await withData((repo) => repo.getClaim(testGame.id)))?.reminded_at).toBeNull();
      expect(
        (await withData((repo) => repo.listClaims())).find((c) => c.game_id === testGame.id)
          ?.reminded_at,
      ).toBeNull();
      await expect(
        withData((repo) => repo.createClaim({ ...testClaim, parent_name: "Other" })),
      ).rejects.toMatchObject({
        code: "ALREADY_CLAIMED",
      });

      await withData((repo) => repo.markReminded(testGame.id, "2026-09-17T14:00:00.000Z"));
      const stored = await withData((repo) => repo.getClaim(testGame.id));
      expect(stored?.reminded_at).toBe("2026-09-17T14:00:00.000Z");
      expect(stored?.email).toBe("sam@example.com");

      const games = await withData((repo) => repo.listGames());
      expect(games.some((g) => g.id === testGame.id)).toBe(true);
      expect(await withData((repo) => repo.getGame("2026-01-01-nope"))).toBeUndefined();
    },
  );
});
