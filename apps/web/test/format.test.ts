import { describe, expect, it } from "vitest";
import { describeSnack, describeTeam } from "../client/lib/format.js";
import { parseRosterLines } from "../client/lib/roster.js";

describe("format", () => {
  it("describes the team with its player count and allergies as a sentence", () => {
    expect(describeTeam(14, "")).toBe("We have 14 players and no food allergies.");
    expect(describeTeam(1, " peanut ")).toBe("We have 1 player and a peanut food allergy.");
    expect(describeTeam(14, "peanut, tree nut")).toBe(
      "We have 14 players and peanut and tree nut food allergies.",
    );
    expect(describeTeam(14, "peanut, tree nut, , egg,")).toBe(
      "We have 14 players and peanut, tree nut and egg food allergies.",
    );
  });

  it("describes the snack slot by name only", () => {
    expect(describeSnack({ snack_by: "Leo Rivera" })).toBe("Snack Duty: Leo Rivera");
    expect(describeSnack({ snack_by: null })).toBe("Snack Duty: nobody yet");
  });

  it("parses 'Player, email, email' lines, keeping commas in names and every address", () => {
    const pasted = [
      "Leo Rivera, rivera@example.com, dad@example.com",
      "Rivera, Ana , ana@example.com",
      "",
      "no email here",
      ", ",
      "only@example.com",
    ].join("\n");
    expect(parseRosterLines(pasted)).toEqual([
      { player: "Leo Rivera", emails: ["rivera@example.com", "dad@example.com"] },
      { player: "Rivera, Ana", emails: ["ana@example.com"] },
    ]);
  });
});
