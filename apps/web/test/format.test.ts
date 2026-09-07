import { describe, expect, it } from "vitest";
import { dateParts, describeSnack, formatDate, formatKickoff } from "../client/lib/format.js";
import { parseRosterLines } from "../client/lib/roster.js";

describe("format", () => {
  it("shows the calendar date as written, not shifted by the time zone", () => {
    expect(formatDate("2026-09-19")).toBe("Sat, Sep 19");
    expect(formatDate("2026-01-01")).toBe("Thu, Jan 1");
  });

  it("splits a date into tile parts without a time-zone shift", () => {
    expect(dateParts("2026-09-19")).toEqual({ month: "SEP", day: "19", weekday: "Sat" });
    expect(dateParts("2026-01-01")).toEqual({ month: "JAN", day: "1", weekday: "Thu" });
  });

  it("renders 24-hour kickoffs as 12-hour", () => {
    expect(formatKickoff("10:00")).toBe("10:00 AM");
    expect(formatKickoff("00:05")).toBe("12:05 AM");
    expect(formatKickoff("12:30")).toBe("12:30 PM");
    expect(formatKickoff("17:45")).toBe("5:45 PM");
  });

  it("describes the snack slot by name only", () => {
    expect(describeSnack({ snack_by: "The Nguyens" })).toBe("Snacks: The Nguyens");
    expect(describeSnack({ snack_by: null })).toBe("Snacks: nobody yet");
  });

  it("parses 'Player Name, email' lines, splitting on the last comma, skipping junk", () => {
    expect(
      parseRosterLines(
        "Leo Rivera, rivera@example.com\nRivera, Ana , ana@example.com\n\nno comma here\n, \n",
      ),
    ).toEqual([
      { player: "Leo Rivera", email: "rivera@example.com" },
      { player: "Rivera, Ana", email: "ana@example.com" },
    ]);
  });
});
