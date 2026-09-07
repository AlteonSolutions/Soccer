import { describe, expect, it } from "vitest";
import { createMemoryRepo } from "../src/data-memory.js";
import { AppError } from "../src/errors.js";
import { claim, game } from "./fixtures.js";

describe("createMemoryRepo", () => {
  it("enforces one claim per game, like the Table Storage row key does", async () => {
    const repo = createMemoryRepo({ games: [game()] });
    await repo.createClaim(claim());
    await expect(repo.createClaim(claim({ parent_name: "Someone Else" }))).rejects.toMatchObject({
      code: "ALREADY_CLAIMED",
    } satisfies Partial<AppError>);
    expect((await repo.getClaim(game().id))?.parent_name).toBe("Sam Rivera");
  });

  it("marks a claim reminded and a game team-reminded without losing the rest", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()] });
    await repo.markReminded(claim().game_id, "2026-09-14T14:00:00.000Z");
    await repo.markTeamReminded(game().id, "2026-09-17T14:00:00.000Z");
    expect((await repo.getClaim(claim().game_id))?.email).toBe("sam@example.com");
    expect((await repo.getGame(game().id))?.team_reminded_at).toBe("2026-09-17T14:00:00.000Z");
  });

  it("keeps the roster unique by email and removes by email", async () => {
    const repo = createMemoryRepo();
    await repo.addRosterMembers([{ email: "a@example.com", added_at: "2026-09-01T00:00:00.000Z" }]);
    await repo.addRosterMembers([
      { email: "a@example.com", added_at: "2026-09-02T00:00:00.000Z" },
      { email: "b@example.com", added_at: "2026-09-02T00:00:00.000Z" },
    ]);
    const list = await repo.listRoster();
    expect(list.map((m) => m.email).sort()).toEqual(["a@example.com", "b@example.com"]);
    expect(list.find((m) => m.email === "a@example.com")?.added_at).toBe(
      "2026-09-01T00:00:00.000Z",
    );
    await repo.removeRosterMember("a@example.com");
    expect((await repo.listRoster()).map((m) => m.email)).toEqual(["b@example.com"]);
  });
});
