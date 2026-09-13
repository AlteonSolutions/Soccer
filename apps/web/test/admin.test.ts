import { createMemoryRepo } from "@soccer/shared";
import { describe, expect, it } from "vitest";
import {
  addGame,
  addRosterMembers,
  listAdminGames,
  releaseClaim,
  removeGame,
  removeRosterMember,
  updateGame,
  updateRosterMember,
} from "../api/src/lib/admin.js";
import { claim, game, member } from "../../../packages/shared/test/fixtures.js";

describe("admin", () => {
  it("adds a game with a derived id and lists it with its claim and the current team-list emails", async () => {
    const repo = createMemoryRepo({
      roster: [member({ emails: ["sam@example.com", "dad@example.com"] })],
    });
    const added = await addGame(repo, {
      date: "2026-09-19",
      kickoff: "10:00",
      opponent: "Red Dragons",
      notes: "",
    });
    expect(added.id).toBe("2026-09-19-red-dragons");
    await repo.createClaim(claim());
    const rows = await listAdminGames(repo);
    expect(rows[0]?.claim?.player).toBe("Leo Rivera");
    expect(rows[0]?.emails).toEqual(["sam@example.com", "dad@example.com"]);
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

  it("adds pasted players in roster order, lets a re-add correct the email, and removes by name", async () => {
    const repo = createMemoryRepo();
    const now = new Date("2026-09-01T00:00:00Z");
    const members = await addRosterMembers(
      repo,
      {
        members: [
          { player: "Mia Chen", emails: ["chen@example.com"] },
          { player: "Leo Rivera", emails: ["old@example.com"] },
          { player: "leo rivera", emails: ["rivera@example.com", "dad@example.com"] },
        ],
      },
      now,
    );
    expect(members.map((m) => `${m.player} ${m.emails.join("+")}`)).toEqual([
      "Mia Chen chen@example.com",
      "leo rivera rivera@example.com+dad@example.com",
    ]);
    await removeRosterMember(repo, "Leo Rivera");
    expect((await repo.listRoster()).map((m) => m.player)).toEqual(["Mia Chen"]);
  });

  it("edits a kickoff in place, keeping the id, the sign-up and the announced mark", async () => {
    const repo = createMemoryRepo({
      games: [game({ team_reminded_at: "2026-09-17T14:00:00.000Z" })],
      claims: [claim()],
    });
    const edited = await updateGame(repo, game().id, {
      date: "2026-09-19",
      kickoff: "12:30",
      opponent: "Red Dragons",
    });
    expect(edited.id).toBe(game().id);
    expect(edited.team_reminded_at).toBe("2026-09-17T14:00:00.000Z");
    expect((await repo.getClaim(game().id))?.player).toBe("Leo Rivera");
  });

  it("moves the sign-up when a date or opponent edit changes the game's id", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()] });
    const edited = await updateGame(repo, game().id, {
      date: "2026-09-20",
      kickoff: "10:00",
      opponent: "Red Dragons",
    });
    expect(edited.id).toBe("2026-09-20-red-dragons");
    expect(await repo.getGame(game().id)).toBeUndefined();
    expect(await repo.getClaim(game().id)).toBeUndefined();
    expect((await repo.getClaim(edited.id))?.player).toBe("Leo Rivera");
  });

  it("refuses an edit that would collide with another game", async () => {
    const repo = createMemoryRepo({
      games: [game(), game({ id: "2026-09-26-everton", date: "2026-09-26", opponent: "Everton" })],
    });
    await expect(
      updateGame(repo, game().id, { date: "2026-09-26", kickoff: "10:00", opponent: "Everton" }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await repo.getGame(game().id)).toBeDefined();
  });

  it("keeps the league's order: imported positions win, hand-added players append", async () => {
    const repo = createMemoryRepo();
    const now = new Date("2026-09-01T00:00:00Z");
    await addRosterMembers(
      repo,
      {
        members: [
          { player: "Zed Last", emails: ["z@example.com"], position: 1 },
          { player: "Amy First", emails: ["a@example.com"], position: 0 },
        ],
      },
      now,
    );
    const list = await addRosterMembers(
      repo,
      { members: [{ player: "Bo Added", emails: ["b@example.com"] }] },
      now,
    );
    expect(list.map((m) => m.player)).toEqual(["Amy First", "Zed Last", "Bo Added"]);
    expect(list.map((m) => m.position)).toEqual([0, 1, 2]);
  });

  it("edits a player's emails in place and renames them, moving their sign-ups along", async () => {
    const repo = createMemoryRepo({
      games: [game()],
      claims: [claim()],
      roster: [member({ position: 3 })],
    });
    const list = await updateRosterMember(repo, "leo rivera", {
      player: "Leo Rivera-Smith",
      emails: ["new@example.com"],
    });
    expect(list).toEqual([
      {
        player: "Leo Rivera-Smith",
        emails: ["new@example.com"],
        added_at: member().added_at,
        position: 3,
      },
    ]);
    expect(await repo.getRosterMember("Leo Rivera")).toBeUndefined();
    expect((await repo.getClaim(game().id))?.player).toBe("Leo Rivera-Smith");
  });

  it("refuses a rename onto another player and an edit of an unknown player", async () => {
    const repo = createMemoryRepo({
      roster: [member(), member({ player: "Mia Chen", emails: ["chen@example.com"] })],
    });
    await expect(
      updateRosterMember(repo, "Leo Rivera", { player: "mia chen", emails: ["x@example.com"] }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      updateRosterMember(repo, "Nobody", { player: "Nobody", emails: ["x@example.com"] }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
