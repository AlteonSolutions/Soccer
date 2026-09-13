import { describe, expect, it } from "vitest";
import { parseScheduleText } from "../src/schedule-import.js";

// The league PDF's text layer, with the coach lines replaced by made-up ones. Same shape as the real thing.
const SAMPLE = `Image not found or type unknown
Program: Fall 2026 - SVU U10 Coed Rec Program
Team: Manchester City
Head Coach: Pat Example (h) 555-0100 (c) 555-0101 pat@example.com
Date Time Game Location
09/19/2026 11:50AM Manchester City versus Chelsea ZH - Monger Park - U10 Field
09/26/2026 10:40AM Manchester City versus Everton ZH - Monger Park - U10 Field
10/03/2026 11:50AM Manchester City versus Manchester United ZH - Monger Park - U10 Field
10/24/2026 1:00PM Manchester City versus Newcastle United ZH - Monger Park - U10 Field
11/07/2026 2:10PM Manchester City versus Chelsea ZH - Monger Park - U10 Field
Game Locations
ZH - Monger Park - U10 Field: 6051 South Valley Pike Mt Crawford, VA 22841
Message from
Weather cancellations may occur.`;

describe("parseScheduleText", () => {
  it("reads every game line, converts the date and 12-hour time, and drops the location", () => {
    const { games, skipped } = parseScheduleText(SAMPLE, "Manchester City");
    expect(skipped).toEqual([]);
    expect(games).toEqual([
      { date: "2026-09-19", kickoff: "11:50", opponent: "Chelsea" },
      { date: "2026-09-26", kickoff: "10:40", opponent: "Everton" },
      { date: "2026-10-03", kickoff: "11:50", opponent: "Manchester United" },
      { date: "2026-10-24", kickoff: "13:00", opponent: "Newcastle United" },
      { date: "2026-11-07", kickoff: "14:10", opponent: "Chelsea" },
    ]);
  });

  it("keeps 'Manchester United' as the opponent even though it shares a prefix with 'Manchester'", () => {
    const { games } = parseScheduleText(
      "10/03/2026 11:50AM Manchester City versus Manchester United ZH - Park - F1",
      "Manchester City",
    );
    expect(games[0]?.opponent).toBe("Manchester United");
  });

  it("finds the opponent when we are listed second (an away game) and handles 12:xx correctly", () => {
    const { games } = parseScheduleText(
      "10/10/2026 12:15PM Aston Villa versus Manchester City ZH - Park - F1\n10/11/2026 12:05AM Manchester City versus Arsenal ZH - Park - F1",
      "Manchester City",
    );
    expect(games.map((g) => [g.opponent, g.kickoff])).toEqual([
      ["Aston Villa", "12:15"],
      ["Arsenal", "00:05"],
    ]);
  });

  it("reports a line that starts like a game but cannot be read, instead of dropping it", () => {
    const { games, skipped } = parseScheduleText(
      "10/17/2026 TBD Manchester City versus Arsenal ZH - Park - F1\n13/45/2026 11:50AM Manchester City versus Chelsea ZH - Park - F1",
      "Manchester City",
    );
    expect(games).toEqual([]);
    expect(skipped).toHaveLength(2);
  });

  it("treats a repeated row as one game and ignores non-game lines", () => {
    const { games } = parseScheduleText(
      "Team: Manchester City\n09/19/2026 11:50AM Manchester City versus Chelsea ZH - Park - F1\n09/19/2026 11:50AM Manchester City versus Chelsea ZH - Park - F1",
      "Manchester City",
    );
    expect(games).toHaveLength(1);
  });
});
