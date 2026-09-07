import { describe, expect, it } from "vitest";
import { describeSnack, formatDate, formatKickoff } from "../client/lib/format.js";

describe("format", () => {
  it("shows the calendar date as written, not shifted by the time zone", () => {
    expect(formatDate("2026-09-19")).toBe("Sat, Sep 19");
    expect(formatDate("2026-01-01")).toBe("Thu, Jan 1");
  });

  it("renders 24-hour kickoffs as 12-hour", () => {
    expect(formatKickoff("10:00")).toBe("10:00 AM");
    expect(formatKickoff("00:05")).toBe("12:05 AM");
    expect(formatKickoff("12:30")).toBe("12:30 PM");
    expect(formatKickoff("17:45")).toBe("5:45 PM");
  });

  it("describes the snack slot by name only", () => {
    expect(describeSnack({ snack_by: "Sam Rivera" })).toBe("Sam Rivera is bringing snacks");
    expect(describeSnack({ snack_by: null })).toBe("Nobody yet");
  });
});
