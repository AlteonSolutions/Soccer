import { describe, expect, it } from "vitest";
import { createMemoryRepo } from "../src/data-memory.js";
import { AppError } from "../src/errors.js";
import { claim, game, member } from "./fixtures.js";

describe("createMemoryRepo", () => {
  it("enforces one claim per game, like the Table Storage row key does", async () => {
    const repo = createMemoryRepo({ games: [game()] });
    await repo.createClaim(claim());
    await expect(repo.createClaim(claim({ player: "Someone Else" }))).rejects.toMatchObject({
      code: "ALREADY_CLAIMED",
    } satisfies Partial<AppError>);
    expect((await repo.getClaim(game().id))?.player).toBe("Leo Rivera");
  });

  it("marks a claim reminded and a game team-reminded without losing the rest", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()] });
    await repo.markReminded(claim().game_id, "2026-09-14T14:00:00.000Z");
    await repo.markTeamReminded(game().id, "2026-09-17T14:00:00.000Z");
    expect((await repo.getClaim(claim().game_id))?.email).toBe("sam@example.com");
    expect((await repo.getGame(game().id))?.team_reminded_at).toBe("2026-09-17T14:00:00.000Z");
  });

  it("keys the roster by player, case-insensitively, replacing on re-add and removing by name", async () => {
    const repo = createMemoryRepo();
    await repo.addRosterMembers([member()]);
    await repo.addRosterMembers([
      member({ player: "leo rivera", email: "new@example.com" }),
      member({ player: "Mia Chen", email: "chen@example.com" }),
    ]);
    expect((await repo.listRoster()).map((m) => m.email).sort()).toEqual([
      "chen@example.com",
      "new@example.com",
    ]);
    expect((await repo.getRosterMember("LEO RIVERA"))?.email).toBe("new@example.com");
    await repo.removeRosterMember("Leo Rivera");
    expect((await repo.listRoster()).map((m) => m.player)).toEqual(["Mia Chen"]);
  });
});
