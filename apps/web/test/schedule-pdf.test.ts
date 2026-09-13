import { readFileSync } from "node:fs";
import { parseRosterText, parseScheduleText } from "@soccer/shared";
import { describe, expect, it } from "vitest";
import { extractPdfText, MAX_PDF_BYTES } from "../api/src/lib/schedule-pdf.js";

// A PDF printed from HTML in the league's layout, with made-up people (test/fixtures/schedule-sample.pdf).
const fixture = new Uint8Array(
  readFileSync(new URL("./fixtures/schedule-sample.pdf", import.meta.url)),
);
const rosterFixture = new Uint8Array(
  readFileSync(new URL("./fixtures/roster-sample.pdf", import.meta.url)),
);

describe("extractPdfText", () => {
  it("reads the fixture PDF's text layer and the parser finds every game in it", async () => {
    const text = await extractPdfText(fixture);
    expect(text).toContain("Manchester City versus Chelsea");
    const { games, skipped } = parseScheduleText(text, "Manchester City");
    expect(skipped).toEqual([]);
    expect(games).toEqual([
      { date: "2026-09-19", kickoff: "11:50", opponent: "Chelsea" },
      { date: "2026-09-26", kickoff: "10:40", opponent: "Everton" },
      { date: "2026-10-24", kickoff: "13:00", opponent: "Newcastle United" },
    ]);
  });

  it("reads the roster fixture and the parser finds every player and email", async () => {
    const { members, no_email } = parseRosterText(await extractPdfText(rosterFixture));
    expect(no_email).toEqual([]);
    expect(members).toEqual([
      { player: "Leo Example", emails: ["pat@example.com"] },
      { player: "Mia Chen", emails: ["wen@example.com", "li@example.com"] },
      { player: "Kai Okafor", emails: ["okafor@example.com"] },
    ]);
  });

  it("rejects an empty upload, an oversized one, and a non-PDF with a form-safe message", async () => {
    await expect(extractPdfText(new Uint8Array())).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(extractPdfText(new Uint8Array(MAX_PDF_BYTES + 1))).rejects.toMatchObject({
      code: "VALIDATION",
    });
    await expect(extractPdfText(new TextEncoder().encode("not a pdf"))).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});
