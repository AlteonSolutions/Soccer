import {
  clearCapturedEmails,
  createMemoryRepo,
  DEFAULT_TEMPLATES,
  defaultSettings,
  readCapturedEmails,
  sendEmail,
  type SendEmail,
} from "@soccer/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { createClaim, type ClaimContext } from "../api/src/lib/claims.js";
import { getSchedule } from "../api/src/lib/schedule.js";
import { claim, game, member } from "../../../packages/shared/test/fixtures.js";

function ctx(overrides: Partial<ClaimContext> = {}): ClaimContext {
  return {
    today: "2026-09-10",
    now: new Date("2026-09-10T15:00:00Z"),
    teamName: "Manchester City",
    siteUrl: "http://localhost:4280",
    coachEmail: undefined,
    allergies: "",
    templates: DEFAULT_TEMPLATES,
    sendEmail,
    log: () => {},
    ...overrides,
  };
}

const input = { game_id: game().id, player: "Leo Rivera" };

describe("createClaim", () => {
  beforeEach(() => clearCapturedEmails());

  it("looks the player up on the team list, stores the player on the claim, and confirms to every address", async () => {
    const repo = createMemoryRepo({
      games: [game()],
      roster: [member({ emails: ["sam@example.com", "dad@example.com"] })],
    });
    const result = await createClaim(repo, { ...input, player: "leo rivera" }, ctx());
    expect(result.game.snack_by).toBe("Leo Rivera");
    expect(result.confirmation_sent).toBe(true);
    expect(JSON.stringify(result)).not.toContain("@");
    expect(JSON.stringify(result)).not.toContain("team_reminded_at");
    expect(readCapturedEmails().map((e) => e.to)).toEqual([["sam@example.com", "dad@example.com"]]);
    expect(readCapturedEmails()[0]?.bcc).toEqual([]);
    expect((await repo.getClaim(game().id))?.player).toBe("Leo Rivera");
  });

  it("rejects a player who is not on the team list", async () => {
    const repo = createMemoryRepo({ games: [game()] });
    await expect(createClaim(repo, input, ctx())).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await repo.getClaim(game().id)).toBeUndefined();
  });

  it("rejects a game that has already been played", async () => {
    const repo = createMemoryRepo({ games: [game({ date: "2026-09-01" })], roster: [member()] });
    await expect(createClaim(repo, input, ctx())).rejects.toMatchObject({ code: "GAME_IN_PAST" });
    expect(await repo.getClaim(game().id)).toBeUndefined();
  });

  it("rejects a game that is not on the schedule", async () => {
    const repo = createMemoryRepo({ roster: [member()] });
    await expect(createClaim(repo, input, ctx())).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects a second claim on the same game", async () => {
    const repo = createMemoryRepo({
      games: [game()],
      claims: [claim({ player: "Mia Chen" })],
      roster: [member()],
    });
    await expect(createClaim(repo, input, ctx())).rejects.toMatchObject({
      code: "ALREADY_CLAIMED",
    });
    expect((await repo.getClaim(game().id))?.player).toBe("Mia Chen");
  });

  it("keeps the claim when the confirmation email fails, and says so", async () => {
    const repo = createMemoryRepo({ games: [game()], roster: [member()] });
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
    expect(result.game.snack_by).toBe("Leo Rivera");
    expect((await repo.getClaim(game().id))?.player).toBe("Leo Rivera");
    expect(logged.join("\n")).toContain("claim.confirmation_failed");
  });
});

describe("getSchedule", () => {
  it("lists player names for the picker and never includes an email address", async () => {
    const repo = createMemoryRepo({
      games: [game()],
      claims: [claim()],
      roster: [member(), member({ player: "Mia Chen", emails: ["chen@example.com"] })],
    });
    const schedule = await getSchedule(repo, "Manchester City");
    expect(schedule.team_name).toBe("Manchester City");
    expect(schedule.allergies).toBe("");
    expect(schedule.logo_url).toBeNull();
    expect(schedule.wordmark_url).toBeNull();
    expect(schedule.games[0]?.snack_by).toBe("Leo Rivera");
    expect(schedule.players).toEqual(["Leo Rivera", "Mia Chen"]);
    expect(JSON.stringify(schedule)).not.toMatch(/@/);
  });

  it("takes the team name, the allergy note and the badge from the coach's settings", async () => {
    const repo = createMemoryRepo({
      settings: {
        ...defaultSettings("Our Team"),
        team_name: "Snack City",
        allergies: "No peanuts, please.",
        logo_updated_at: "2026-09-14T10:00:00.000Z",
        wordmark_updated_at: "2026-09-15T10:00:00.000Z",
      },
    });
    const schedule = await getSchedule(repo, "Manchester City");
    expect(schedule.team_name).toBe("Snack City");
    expect(schedule.allergies).toBe("No peanuts, please.");
    expect(schedule.logo_url).toBe("/api/assets/logo?v=2026-09-14T10%3A00%3A00.000Z");
    expect(schedule.wordmark_url).toBe("/api/assets/wordmark?v=2026-09-15T10%3A00%3A00.000Z");
  });
});
