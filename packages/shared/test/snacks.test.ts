import { describe, expect, it } from "vitest";
import { publicGameSchema } from "../src/schemas.js";
import {
  addDays,
  gameIdFor,
  isPastGame,
  localDateIso,
  reminderEmail,
  selectSnackReminders,
  selectTeamReminders,
  selectUnclaimed,
  rosterEmails,
  teamReminderEmail,
  toPlayerNames,
  toPublicSchedule,
  weekdayOf,
} from "../src/snacks.js";
import { claim, game, member } from "./fixtures.js";

describe("toPublicSchedule", () => {
  it("shows who is bringing snacks by name and never carries the email or internal columns", () => {
    const rows = toPublicSchedule(
      [game({ team_reminded_at: "2026-09-17T14:00:00.000Z" })],
      [claim()],
    );
    expect(rows[0]?.snack_by).toBe("Leo Rivera");
    expect(JSON.stringify(rows)).not.toContain("sam@example.com");
    expect(JSON.stringify(rows)).not.toContain("team_reminded_at");
    expect(publicGameSchema.safeParse(rows[0]).success).toBe(true);
  });

  it("sorts by date then kickoff and marks unclaimed games with null", () => {
    const rows = toPublicSchedule(
      [
        game({ id: "b", date: "2026-10-03" }),
        game({ id: "a", date: "2026-09-26", kickoff: "12:00" }),
        game({ id: "c", date: "2026-09-26", kickoff: "09:00" }),
      ],
      [],
    );
    expect(rows.map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(rows.every((r) => r.snack_by === null)).toBe(true);
  });
});

// 2026-09-14 is a Monday; 2026-09-17 a Thursday; 2026-09-19 a Saturday.
describe("selectSnackReminders (Monday)", () => {
  it("picks this week's claimed game and skips a claim already reminded", () => {
    const games = [
      game({ id: "sat", date: "2026-09-19" }),
      game({ id: "next", date: "2026-09-26" }),
      game({ id: "done", date: "2026-09-19" }),
    ];
    const claims = [
      claim({ game_id: "sat" }),
      claim({ game_id: "next" }),
      claim({ game_id: "done", reminded_at: "2026-09-14T14:00:00.000Z" }),
    ];
    expect(selectSnackReminders(games, claims, "2026-09-14").map((d) => d.game.id)).toEqual([
      "sat",
    ]);
  });

  it("covers Monday through Sunday, not last Saturday", () => {
    const games = [
      game({ id: "last", date: "2026-09-12" }),
      game({ id: "mon", date: "2026-09-14" }),
      game({ id: "sun", date: "2026-09-20" }),
      game({ id: "beyond", date: "2026-09-21" }),
    ];
    const claims = games.map((g) => claim({ game_id: g.id }));
    expect(selectSnackReminders(games, claims, "2026-09-14").map((d) => d.game.id)).toEqual([
      "mon",
      "sun",
    ]);
  });

  it("ignores a claim whose game was deleted", () => {
    expect(selectSnackReminders([], [claim()], "2026-09-14")).toEqual([]);
  });
});

describe("selectTeamReminders (Thursday)", () => {
  it("picks Saturday's game once, and not next week's", () => {
    const games = [
      game({ id: "sat", date: "2026-09-19" }),
      game({ id: "told", date: "2026-09-19", team_reminded_at: "2026-09-17T14:00:00.000Z" }),
      game({ id: "next", date: "2026-09-26" }),
    ];
    expect(selectTeamReminders(games, "2026-09-17").map((g) => g.id)).toEqual(["sat"]);
  });
});

describe("selectUnclaimed", () => {
  it("lists this week's games with no claim", () => {
    const games = [
      game({ id: "claimed", date: "2026-09-19" }),
      game({ id: "open", date: "2026-09-20" }),
      game({ id: "far", date: "2026-10-12" }),
    ];
    expect(
      selectUnclaimed(games, [claim({ game_id: "claimed" })], "2026-09-14").map((g) => g.id),
    ).toEqual(["open"]);
  });
});

describe("dates", () => {
  it("computes today in the team's zone, not UTC", () => {
    // 03:30 UTC on the 11th is still the evening of the 10th in New York.
    const now = new Date("2026-09-11T03:30:00Z");
    expect(localDateIso(now, "America/New_York")).toBe("2026-09-10");
    expect(localDateIso(now, "UTC")).toBe("2026-09-11");
  });

  it("adds days across a month boundary", () => {
    expect(addDays("2026-09-29", 2)).toBe("2026-10-01");
  });

  it("knows the weekday of a calendar date regardless of machine zone", () => {
    expect(weekdayOf("2026-09-14")).toBe(1);
    expect(weekdayOf("2026-09-17")).toBe(4);
    expect(weekdayOf("2026-09-19")).toBe(6);
  });

  it("treats today as playable and yesterday as past", () => {
    expect(isPastGame({ date: "2026-09-10" }, "2026-09-10")).toBe(false);
    expect(isPastGame({ date: "2026-09-09" }, "2026-09-10")).toBe(true);
  });
});

describe("gameIdFor", () => {
  it("builds a sortable, URL-safe id from date and opponent", () => {
    expect(gameIdFor({ date: "2026-09-19", opponent: "Red Dragons FC!" })).toBe(
      "2026-09-19-red-dragons-fc",
    );
    expect(gameIdFor({ date: "2026-09-19", opponent: "???" })).toBe("2026-09-19-game");
  });
});

describe("roster views", () => {
  it("exposes sorted player names and nothing else, and one email per parent", () => {
    const roster = [
      member({ player: "Mia Chen", email: "chen@example.com" }),
      member(),
      member({ player: "Ana Rivera" }),
    ];
    expect(toPlayerNames(roster)).toEqual(["Ana Rivera", "Leo Rivera", "Mia Chen"]);
    expect(JSON.stringify(toPlayerNames(roster))).not.toContain("@");
    expect(rosterEmails(roster)).toEqual(["chen@example.com", "sam@example.com"]);
  });
});

describe("emails", () => {
  it("snack reminder names the player, the game and the site", () => {
    const copy = reminderEmail(game(), claim(), "Manchester City", "https://example.org");
    expect(copy.subject).toBe("Manchester City: snacks this week — 2026-09-19");
    expect(copy.text).toContain("Leo Rivera's family");
    expect(copy.text).toContain("Red Dragons");
    expect(copy.text).toContain("https://example.org");
  });

  it("team reminder names the snack family, never their email, and points at the site when open", () => {
    const withSnacks = teamReminderEmail(game(), claim(), "Manchester City", "https://example.org");
    expect(withSnacks.subject).toBe("Manchester City: game this Saturday vs Red Dragons");
    expect(withSnacks.text).toContain("Snacks: Leo Rivera's family");
    expect(withSnacks.text).not.toContain("sam@example.com");
    const open = teamReminderEmail(game(), undefined, "Manchester City", "https://example.org");
    expect(open.text).toContain("nobody has signed up yet");
    expect(open.text).toContain("https://example.org");
  });
});
