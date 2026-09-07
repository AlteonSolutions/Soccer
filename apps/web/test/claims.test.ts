import {
  clearCapturedEmails,
  createMemoryRepo,
  readCapturedEmails,
  sendEmail,
  type SendEmail,
} from "@soccer/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { createClaim, type ClaimContext } from "../api/src/lib/claims.js";
import { getSchedule } from "../api/src/lib/schedule.js";
import { claim, game } from "../../../packages/shared/test/fixtures.js";

function ctx(overrides: Partial<ClaimContext> = {}): ClaimContext {
  return {
    today: "2026-09-10",
    now: new Date("2026-09-10T15:00:00Z"),
    teamName: "Tigers",
    siteUrl: "http://localhost:4280",
    sendEmail,
    log: () => {},
    ...overrides,
  };
}

const input = { game_id: game().id, parent_name: "Sam Rivera", email: "sam@example.com" };

describe("createClaim", () => {
  beforeEach(() => clearCapturedEmails());

  it("stores the claim, returns the public view, and sends a confirmation to the parent only", async () => {
    const repo = createMemoryRepo({ games: [game()] });
    const result = await createClaim(repo, input, ctx());
    expect(result.game.snack_by).toBe("Sam Rivera");
    expect(result.confirmation_sent).toBe(true);
    expect(JSON.stringify(result)).not.toContain("sam@example.com");
    expect(readCapturedEmails()).toHaveLength(1);
    expect(readCapturedEmails()[0]?.to).toBe("sam@example.com");
    expect((await repo.getClaim(game().id))?.email).toBe("sam@example.com");
  });

  it("rejects a game that has already been played", async () => {
    const repo = createMemoryRepo({ games: [game({ date: "2026-09-01" })] });
    await expect(createClaim(repo, input, ctx())).rejects.toMatchObject({ code: "GAME_IN_PAST" });
    expect(await repo.getClaim(game().id)).toBeUndefined();
  });

  it("rejects a game that is not on the schedule", async () => {
    await expect(createClaim(createMemoryRepo(), input, ctx())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejects a second claim on the same game", async () => {
    const repo = createMemoryRepo({
      games: [game()],
      claims: [claim({ parent_name: "First Family" })],
    });
    await expect(createClaim(repo, input, ctx())).rejects.toMatchObject({
      code: "ALREADY_CLAIMED",
    });
    expect((await repo.getClaim(game().id))?.parent_name).toBe("First Family");
  });

  it("keeps the claim when the confirmation email fails, and says so", async () => {
    const repo = createMemoryRepo({ games: [game()] });
    const failing: SendEmail = async () => {
      throw new Error("ACS down");
    };
    const logged: string[] = [];
    const result = await createClaim(
      repo,
      input,
      ctx({ sendEmail: failing, log: (l) => logged.push(l) }),
    );
    expect(result.confirmation_sent).toBe(false);
    expect(result.game.snack_by).toBe("Sam Rivera");
    expect((await repo.getClaim(game().id))?.parent_name).toBe("Sam Rivera");
    expect(logged.join("\n")).toContain("claim.confirmation_failed");
  });
});

describe("getSchedule", () => {
  it("never includes an email address, even when every game is claimed", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()] });
    const schedule = await getSchedule(repo, "Tigers");
    expect(schedule.team_name).toBe("Tigers");
    expect(schedule.games[0]?.snack_by).toBe("Sam Rivera");
    expect(JSON.stringify(schedule)).not.toMatch(/@/);
  });
});
