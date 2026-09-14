import { describe, expect, it } from "vitest";
import { dateParts, formatDate, formatKickoff } from "../src/format.js";

describe("format", () => {
  it("shows the calendar date as m/d, as written, never shifted by the time zone", () => {
    expect(formatDate("2026-09-19")).toBe("9/19");
    expect(formatDate("2026-01-01")).toBe("1/1");
    expect(formatDate("2026-10-03")).toBe("10/3");
  });

  it("splits a date into tile parts without a time-zone shift", () => {
    expect(dateParts("2026-09-19")).toEqual({ month: "SEP", day: "19" });
    expect(dateParts("2026-01-01")).toEqual({ month: "JAN", day: "1" });
  });

  it("renders 24-hour kickoffs as 12-hour", () => {
    expect(formatKickoff("10:00")).toBe("10:00 AM");
    expect(formatKickoff("00:05")).toBe("12:05 AM");
    expect(formatKickoff("12:30")).toBe("12:30 PM");
    expect(formatKickoff("17:45")).toBe("5:45 PM");
  });
});
