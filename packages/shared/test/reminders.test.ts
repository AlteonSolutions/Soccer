import { createMemoryRepo } from "../src/data-memory.js";
import {
  clearCapturedEmails,
  readCapturedEmails,
  sendEmail,
  type SendEmail,
} from "../src/email.js";
import { beforeEach, describe, expect, it } from "vitest";
import { runReminders, type RunContext } from "../src/reminders.js";
import { DEFAULT_TEMPLATES } from "../src/templates.js";
import { claim, game, member } from "./fixtures.js";

// 2026-09-14 Monday, 2026-09-15 Tuesday, 2026-09-17 Thursday; the fixture game is Saturday the 19th.
function ctx(overrides: Partial<RunContext> = {}): RunContext {
  return {
    today: "2026-09-14",
    now: new Date("2026-09-14T14:00:00Z"),
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

// Leo Rivera (the fixture claim's player) has two parents; two other players share one address.
const roster = [
  member({ player: "Leo Rivera", emails: ["sam@example.com", "dad@example.com"] }),
  member({ player: "Ann A", emails: ["a@example.com"] }),
  member({ player: "Andy A", emails: ["a@example.com", "a2@example.com"] }),
  member({ player: "Bea B", emails: ["b@example.com"] }),
];
const everyAddress = [
  "a2@example.com",
  "a@example.com",
  "b@example.com",
  "dad@example.com",
  "sam@example.com",
];

describe("runReminders", () => {
  beforeEach(() => clearCapturedEmails());

  it("does nothing on a day that is neither Monday nor Thursday", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()], roster });
    const summary = await runReminders(repo, ctx({ today: "2026-09-15" }));
    expect(summary.day).toBe("other");
    expect(readCapturedEmails()).toHaveLength(0);
  });

  it("Monday: reminds the snack family at the addresses on the team list today, once", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()], roster });
    const first = await runReminders(repo, ctx());
    expect(first.day).toBe("monday");
    expect(first.snack_reminders_sent).toBe(1);
    expect(readCapturedEmails().map((e) => e.to)).toEqual([["sam@example.com", "dad@example.com"]]);

    const again = await runReminders(repo, ctx({ now: new Date("2026-09-14T20:00:00Z") }));
    expect(again.snack_reminders_sent).toBe(0);
    expect(readCapturedEmails()).toHaveLength(1);
  });

  it("Monday: uses an address corrected after sign-up", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()], roster });
    await repo.addRosterMembers([member({ player: "Leo Rivera", emails: ["fixed@example.com"] })]);
    await runReminders(repo, ctx());
    expect(readCapturedEmails().map((e) => e.to)).toEqual([["fixed@example.com"]]);
  });

  it("Monday: does not mark a claim reminded when every send fails, so it is retried", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()], roster });
    const failing: SendEmail = async () => {
      throw new Error("ACS down");
    };
    const summary = await runReminders(repo, ctx({ sendEmail: failing }));
    expect(summary.snack_reminders_failed).toBe(1);
    expect((await repo.getClaim(game().id))?.reminded_at).toBeNull();
  });

  it("Monday: a player no longer on the team list gets nothing and is logged, not marked", async () => {
    const repo = createMemoryRepo({
      games: [game()],
      claims: [claim({ player: "Gone Kid" })],
      roster,
    });
    const logged: string[] = [];
    const summary = await runReminders(repo, ctx({ log: (l) => logged.push(l) }));
    expect(summary.snack_reminders_failed).toBe(1);
    expect(readCapturedEmails()).toHaveLength(0);
    expect(logged.join("\n")).toContain("reminder.no_recipient");
    expect((await repo.getClaim(game().id))?.reminded_at).toBeNull();
  });

  it("Monday: nudges the coach about an unclaimed game only when the nudge has somewhere to go", async () => {
    const repo = createMemoryRepo({ games: [game()], roster });
    expect((await runReminders(repo, ctx())).coach_nudged).toBe(false);
    const summary = await runReminders(repo, ctx({ coachEmail: "coach@example.com" }));
    expect(summary.coach_nudged).toBe(true);
    expect(summary.unclaimed_games).toBe(1);
    expect(readCapturedEmails().at(-1)?.to).toEqual(["coach@example.com"]);
  });

  it("Monday: the coach's To/BCC edits are honoured, with a literal address and a copy to the coach", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()], roster });
    const templates = {
      ...DEFAULT_TEMPLATES,
      snack_reminder: {
        ...DEFAULT_TEMPLATES.snack_reminder,
        to: "{{parents}}, helper@example.com",
        bcc: "{{coach}}",
      },
    };
    await runReminders(repo, ctx({ templates, coachEmail: "coach@example.com" }));
    const sent = readCapturedEmails()[0];
    expect(sent?.to).toEqual(["sam@example.com", "dad@example.com", "helper@example.com"]);
    expect(sent?.bcc).toEqual(["coach@example.com"]);
  });

  it("Thursday: one message, To the coach and BCC every distinct address on the team list", async () => {
    const repo = createMemoryRepo({ games: [game()], claims: [claim()], roster });
    const summary = await runReminders(
      repo,
      ctx({
        today: "2026-09-17",
        now: new Date("2026-09-17T14:00:00Z"),
        coachEmail: "coach@example.com",
      }),
    );
    expect(summary.day).toBe("thursday");
    expect(summary.team_reminders_sent).toBe(everyAddress.length + 1);
    const sent = readCapturedEmails();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toEqual(["coach@example.com"]);
    expect([...(sent[0]?.bcc ?? [])].sort()).toEqual(everyAddress);
    expect(sent[0]?.text).toContain("Snacks: Leo Rivera.");
    expect(sent[0]?.text).not.toContain("@example.com");
    expect((await repo.getGame(game().id))?.team_reminded_at).toBe("2026-09-17T14:00:00.000Z");

    const again = await runReminders(
      repo,
      ctx({ today: "2026-09-17", now: new Date("2026-09-17T20:00:00Z") }),
    );
    expect(again.team_reminders_sent).toBe(0);
    expect(readCapturedEmails()).toHaveLength(1);
  });

  it("Thursday: with no coach email the team still gets the reminder, in BCC only", async () => {
    const repo = createMemoryRepo({ games: [game()], roster });
    await runReminders(repo, ctx({ today: "2026-09-17", now: new Date("2026-09-17T14:00:00Z") }));
    const sent = readCapturedEmails()[0];
    expect(sent?.to).toEqual([]);
    expect([...(sent?.bcc ?? [])].sort()).toEqual(everyAddress);
  });

  it("Thursday: a failed send is counted, logged, and never retried to everyone", async () => {
    const repo = createMemoryRepo({ games: [game()], roster });
    const failing: SendEmail = async () => {
      throw new Error("bounce");
    };
    const logged: string[] = [];
    const summary = await runReminders(
      repo,
      ctx({
        today: "2026-09-17",
        now: new Date("2026-09-17T14:00:00Z"),
        sendEmail: failing,
        log: (l) => logged.push(l),
      }),
    );
    expect(summary.team_reminders_sent).toBe(0);
    expect(summary.team_reminders_failed).toBe(everyAddress.length);
    expect(logged.join("\n")).toContain("team_reminder.failed");
    expect((await repo.getGame(game().id))?.team_reminded_at).not.toBeNull();
  });
});
