import { describe, expect, it } from "vitest";
import { parseRosterText } from "../src/roster-import.js";

// The league roster's text layer with made-up people; same line shapes as the real one.
const SAMPLE = `Image not found or type unknown
Program: Fall 2026 - SVU U10 Coed Rec Program
Team: Manchester City
Head Coach: Pat Coach (h) 555-0100 (c) 555-0101 coach@example.com
Player School Parent/Guardian(s)
Leo Example (M) Home Schooled Pat Example, 555-0100 (h), Pat@Example.com
Sam Example, 555-0101 (h)
Mia Chen (F) John C. Myers Elementary Wen Chen, 555-0102 (h), 555-0103 (c), wen@example.com
Li Chen, 555-0104 (c), li@example.com
Kai Okafor (M) Lacey Spring Elementary 5550105, 555-0105 (h), okafor@example.com
Ana Nophone (F) Rockingham County Jo Nophone, 555-0106 (h)
Bo Many (M) Some School A, a@example.com
B, b@example.com
C, c@example.com
D, d@example.com
E, e@example.com`;

describe("parseRosterText", () => {
  it("takes the player name before the (M)/(F) marker and every email in the block, lower-cased", () => {
    const { members } = parseRosterText(SAMPLE);
    expect(members.slice(0, 3)).toEqual([
      { player: "Leo Example", emails: ["pat@example.com"] },
      { player: "Mia Chen", emails: ["wen@example.com", "li@example.com"] },
      { player: "Kai Okafor", emails: ["okafor@example.com"] },
    ]);
  });

  it("reports a player with no email instead of dropping them", () => {
    const { members, no_email } = parseRosterText(SAMPLE);
    expect(no_email).toEqual(["Ana Nophone"]);
    expect(members.some((m) => m.player === "Ana Nophone")).toBe(false);
  });

  it("keeps the first four addresses and says so when a block has more", () => {
    const { members, truncated } = parseRosterText(SAMPLE);
    expect(truncated).toEqual(["Bo Many"]);
    expect(members.find((m) => m.player === "Bo Many")?.emails).toHaveLength(4);
  });

  it("never treats the coach line or header as a player", () => {
    const { members, no_email } = parseRosterText(SAMPLE);
    const names = [...members.map((m) => m.player), ...no_email];
    expect(names).not.toContain("Pat Coach");
    expect(names.some((n) => n.includes("Player"))).toBe(false);
  });
});
