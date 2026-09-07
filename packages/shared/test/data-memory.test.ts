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

  it("marks a claim reminded without losing the rest of it", async () => {
    const repo = createMemoryRepo({ claims: [claim()] });
    await repo.markReminded(claim().game_id, "2026-09-17T14:00:00.000Z");
    const stored = await repo.getClaim(claim().game_id);
    expect(stored?.reminded_at).toBe("2026-09-17T14:00:00.000Z");
    expect(stored?.email).toBe("sam@example.com");
  });
});
