import { createMemoryRepo } from "@soccer/shared";
import { describe, expect, it } from "vitest";
import {
  addGame,
  addRosterMembers,
  listAdminGames,
  releaseClaim,
  removeGame,
  removeRosterMember,
} from "../api/src/lib/admin.js";
import { claim, game } from "../../../packages/shared/test/fixtures.js";

describe("admin", () => {
  it("adds a game with a derived id and lists it with its claim, email included", async () => {
    const repo = createMemoryRepo();
    const added = await addGame(repo, {
      date: "2026-09-19",
      kickoff: "10:00",
      opponent: "Red Dragons",
      location: "Field 3",
      notes: "",
    });
    expect(added.id).toBe("2026-09-19-red-dragons");
    await repo.createClaim(claim());
    const rows = await listAdminGames(repo);
    expect(rows[0]?.claim?.email).toBe("sam@example.com");
  });

  it("removing a game removes its claim so no reminder can go out for it", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()] });
    await removeGame(repo, game().id);
    expect(await repo.getGame(game().id)).toBeUndefined();
    expect(await repo.getClaim(game().id)).toBeUndefined();
  });

  it("releasing a slot keeps the game", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()] });
    await releaseClaim(repo, game().id);
    expect(await repo.getClaim(game().id)).toBeUndefined();
    expect(await repo.getGame(game().id)).toBeDefined();
  });

  it("adds pasted players sorted by name, lets a re-add correct the email, and removes by name", async () => {
    const repo = createMemoryRepo();
    const now = new Date("2026-09-01T00:00:00Z");
    const members = await addRosterMembers(
      repo,
      {
        members: [
          { player: "Mia Chen", email: "chen@example.com" },
          { player: "Leo Rivera", email: "old@example.com" },
          { player: "leo rivera", email: "rivera@example.com" },
        ],
      },
      now,
    );
    expect(members.map((m) => `${m.player} ${m.email}`)).toEqual([
      "leo rivera rivera@example.com",
      "Mia Chen chen@example.com",
    ]);
    await removeRosterMember(repo, "Leo Rivera");
    expect((await repo.listRoster()).map((m) => m.player)).toEqual(["Mia Chen"]);
  });
});
