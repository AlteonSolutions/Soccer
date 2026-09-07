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

function ctx(overrides: Partial<RunContext> = {}): RunContext {
  return {
    today: "2026-09-17",
    now: new Date("2026-09-17T14:00:00Z"),
    daysAhead: 2,
    teamName: "Tigers",
    siteUrl: "http://localhost:4280",
    coachEmail: undefined,
    sendEmail,
    log: () => {},
    ...overrides,
  };
}

describe("runReminders", () => {
  beforeEach(() => clearCapturedEmails());

  it("sends one reminder per due claim and never sends it again on the next run", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()] });
    const first = await runReminders(repo, ctx());
    expect(first.reminders_sent).toBe(1);
    expect(readCapturedEmails()[0]?.to).toBe("sam@example.com");

    const second = await runReminders(
      repo,
      ctx({ now: new Date("2026-09-18T14:00:00Z"), today: "2026-09-18" }),
    );
    expect(second.reminders_sent).toBe(0);
    expect(readCapturedEmails()).toHaveLength(1);
  });

  it("does not mark a claim reminded when the send fails, so it is retried tomorrow", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()] });
    const failing: SendEmail = async () => {
      throw new Error("ACS down");
    };
    const summary = await runReminders(repo, ctx({ sendEmail: failing }));
    expect(summary.reminders_failed).toBe(1);
    expect((await repo.getClaim(game().id))?.reminded_at).toBeNull();
  });

  it("nudges the coach about unclaimed games only when a coach email is configured", async () => {
    const repo = createMemoryRepo({ games: [game()] });
    expect((await runReminders(repo, ctx())).coach_nudged).toBe(false);
    const summary = await runReminders(repo, ctx({ coachEmail: "coach@example.com" }));
    expect(summary.coach_nudged).toBe(true);
    expect(summary.unclaimed_games).toBe(1);
    expect(readCapturedEmails().at(-1)?.to).toBe("coach@example.com");
  });
});
