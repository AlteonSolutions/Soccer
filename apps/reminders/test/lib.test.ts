import {
  clearCapturedEmails,
  createMemoryRepo,
  readCapturedEmails,
  sendEmail,
  type SendEmail,
} from "@soccer/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { runReminders, type RunContext } from "../src/lib.js";
import { claim, game } from "../../../packages/shared/test/fixtures.js";

// 2026-09-14 Monday, 2026-09-15 Tuesday, 2026-09-17 Thursday; the fixture game is Saturday the 19th.
function ctx(overrides: Partial<RunContext> = {}): RunContext {
  return {
    today: "2026-09-14",
    now: new Date("2026-09-14T14:00:00Z"),
    teamName: "Manchester City",
    siteUrl: "http://localhost:4280",
    coachEmail: undefined,
    sendEmail,
    log: () => {},
    ...overrides,
  };
}

// Two players share one parent address: Thursday must email it once.
const roster = [
  { player: "Ann A", email: "a@example.com", added_at: "2026-09-01T00:00:00.000Z" },
  { player: "Andy A", email: "a@example.com", added_at: "2026-09-01T00:00:00.000Z" },
  { player: "Bea B", email: "b@example.com", added_at: "2026-09-01T00:00:00.000Z" },
];

const thursday = { today: "2026-09-17", now: new Date("2026-09-17T14:00:00Z") };

describe("runReminders", () => {
  beforeEach(() => clearCapturedEmails());

  it("does nothing on a day that is neither Monday nor Thursday", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()], roster });
    const summary = await runReminders(repo, ctx({ today: "2026-09-15" }));
    expect(summary.day).toBe("other");
    expect(readCapturedEmails()).toHaveLength(0);
  });

  it("Monday: reminds the snack family once, never again next Monday", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()], roster });
    const first = await runReminders(repo, ctx());
    expect(first.day).toBe("monday");
    expect(first.snack_reminders_sent).toBe(1);
    expect(readCapturedEmails()[0]?.to).toBe("sam@example.com");
    expect(readCapturedEmails()).toHaveLength(1); // nothing to the team on Monday

    const again = await runReminders(repo, ctx({ now: new Date("2026-09-14T20:00:00Z") }));
    expect(again.snack_reminders_sent).toBe(0);
    expect(readCapturedEmails()).toHaveLength(1);
  });

  it("Monday: does not mark a claim reminded when the send fails, so it is retried", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()] });
    const failing: SendEmail = async () => {
      throw new Error("ACS down");
    };
    const summary = await runReminders(repo, ctx({ sendEmail: failing }));
    expect(summary.snack_reminders_failed).toBe(1);
    expect((await repo.getClaim(game().id))?.reminded_at).toBeNull();
  });

  it("Monday: nudges the coach about an unclaimed game only when a coach email is configured", async () => {
    const repo = createMemoryRepo({ games: [game()] });
    expect((await runReminders(repo, ctx())).coach_nudged).toBe(false);
    const summary = await runReminders(repo, ctx({ coachEmail: "coach@example.com" }));
    expect(summary.coach_nudged).toBe(true);
    expect(summary.unclaimed_games).toBe(1);
    expect(readCapturedEmails().at(-1)?.to).toBe("coach@example.com");
  });

  it("Thursday: emails each address once, the snack family included, about Saturday's game", async () => {
    // The snack family (sam@) is no longer on the team list; they must still get Thursday's email.
    const repo = createMemoryRepo({ games: [game()], claims: [claim()], roster });
    const summary = await runReminders(repo, ctx(thursday));
    expect(summary.day).toBe("thursday");
    expect(summary.team_reminders_sent).toBe(3);
    const sent = readCapturedEmails();
    expect(sent.map((e) => e.to).sort()).toEqual([
      "a@example.com",
      "b@example.com",
      "sam@example.com",
    ]);
    expect(sent[0]?.text).toContain("Snacks: Leo Rivera's family");
    expect(sent[0]?.text).not.toContain("@example.com");
    expect((await repo.getGame(game().id))?.team_reminded_at).toBe("2026-09-17T14:00:00.000Z");

    const again = await runReminders(
      repo,
      ctx({ ...thursday, now: new Date("2026-09-17T20:00:00Z") }),
    );
    expect(again.team_reminders_sent).toBe(0);
    expect(readCapturedEmails()).toHaveLength(3);
  });

  it("Thursday: one bad address does not stop the others or cause a re-send", async () => {
    const repo = createMemoryRepo({ games: [game()], roster });
    const flaky: SendEmail = async (m) => {
      if (m.to === "a@example.com") throw new Error("bounce");
      return { mode: "captured", id: "x" };
    };
    const summary = await runReminders(repo, ctx({ ...thursday, sendEmail: flaky }));
    expect(summary.team_reminders_sent).toBe(1);
    expect(summary.team_reminders_failed).toBe(1);
    expect((await repo.getGame(game().id))?.team_reminded_at).not.toBeNull();
  });
});
