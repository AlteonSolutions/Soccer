import { describe, expect, it } from "vitest";
import { publicGameSchema } from "../src/schemas.js";
import {
  addDays,
  gameIdFor,
  isPastGame,
  localDateIso,
  reminderEmail,
  selectRemindersDue,
  selectUnclaimed,
  toPublicSchedule,
} from "../src/snacks.js";
import { claim, game } from "./fixtures.js";

describe("toPublicSchedule", () => {
  it("shows who is bringing snacks by name and never carries the email", () => {
    const rows = toPublicSchedule([game()], [claim()]);
    expect(rows[0]?.snack_by).toBe("Sam Rivera");
    expect(JSON.stringify(rows)).not.toContain("sam@example.com");
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

describe("selectRemindersDue", () => {
  it("picks claims for games within the window and skips ones already reminded", () => {
    const games = [
      game({ id: "soon", date: "2026-09-12" }),
      game({ id: "later", date: "2026-09-20" }),
      game({ id: "done", date: "2026-09-11" }),
    ];
    const claims = [
      claim({ game_id: "soon" }),
      claim({ game_id: "later" }),
      claim({ game_id: "done", reminded_at: "2026-09-09T14:00:00.000Z" }),
    ];
    const due = selectRemindersDue(games, claims, "2026-09-10", 2);
    expect(due.map((d) => d.game.id)).toEqual(["soon"]);
  });

  it("includes a game today and a game exactly at the horizon, excludes yesterday", () => {
    const games = [
      game({ id: "yesterday", date: "2026-09-09" }),
      game({ id: "today", date: "2026-09-10" }),
      game({ id: "edge", date: "2026-09-12" }),
    ];
    const claims = games.map((g) => claim({ game_id: g.id }));
    expect(selectRemindersDue(games, claims, "2026-09-10", 2).map((d) => d.game.id)).toEqual([
      "today",
      "edge",
    ]);
  });

  it("ignores a claim whose game was deleted", () => {
    expect(selectRemindersDue([], [claim()], "2026-09-18", 2)).toEqual([]);
  });
});

describe("selectUnclaimed", () => {
  it("lists upcoming games in the window with no claim", () => {
    const games = [
      game({ id: "claimed", date: "2026-09-11" }),
      game({ id: "open", date: "2026-09-12" }),
      game({ id: "far", date: "2026-10-12" }),
    ];
    expect(
      selectUnclaimed(games, [claim({ game_id: "claimed" })], "2026-09-10", 2).map((g) => g.id),
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

describe("reminderEmail", () => {
  it("names the parent, the game and the site, and includes coach notes when present", () => {
    const copy = reminderEmail(
      game({ notes: "Bring extra water" }),
      claim(),
      "Tigers",
      "https://example.org",
    );
    expect(copy.subject).toBe("Tigers: snack reminder for 2026-09-19");
    expect(copy.text).toContain("Sam Rivera");
    expect(copy.text).toContain("Red Dragons");
    expect(copy.text).toContain("Bring extra water");
    expect(copy.text).toContain("https://example.org");
  });
});
