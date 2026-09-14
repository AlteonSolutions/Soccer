import { describe, expect, it } from "vitest";
import { EMAIL_KINDS } from "../src/schemas.js";
import { confirmationEmail, unclaimedNudgeEmail } from "../src/snacks.js";
import { DEFAULT_TEMPLATES, renderTemplate, TEMPLATE_PLACEHOLDERS } from "../src/templates.js";
import { claim, game } from "./fixtures.js";

describe("renderTemplate", () => {
  it("fills known placeholders, tolerates spaces, and leaves unknown ones visible", () => {
    const out = renderTemplate(
      { subject: "{{team}}: {{ date }}", text: "Hi {{player}}, see {{typo}}." },
      { team: "City", date: "2026-09-19", player: "Leo" },
    );
    expect(out).toEqual({ subject: "City: 2026-09-19", text: "Hi Leo, see {{typo}}." });
  });

  it("every default template uses only the placeholders its legend lists", () => {
    for (const kind of EMAIL_KINDS) {
      const template = DEFAULT_TEMPLATES[kind];
      const used = [
        ...`${template.subject}\n${template.text}`.matchAll(/\{\{\s*(\w+)\s*\}\}/g),
      ].map((m) => m[1]);
      for (const name of used) expect(Object.keys(TEMPLATE_PLACEHOLDERS[kind])).toContain(name);
    }
  });

  it("a coach-edited template changes the email that goes out", () => {
    const site = {
      teamName: "City",
      siteUrl: "https://example.org",
      templates: {
        ...DEFAULT_TEMPLATES,
        claim_confirmation: {
          subject: "Snacks on {{date}} – thank you!",
          text: "{{player}} vs {{opponent}} at {{kickoff}}. {{site_url}}",
        },
      },
    };
    const copy = confirmationEmail(game(), claim(), site);
    expect(copy.subject).toBe("Snacks on 9/19 – thank you!");
    expect(copy.text).toBe("Leo Rivera vs Red Dragons at 10:00 AM. https://example.org");
    const nudge = unclaimedNudgeEmail([game()], site);
    expect(nudge.subject).toBe("City: 1 upcoming game(s) with no snack sign-up");
    expect(nudge.text).toContain("  - 9/19 at 10:00 AM vs Red Dragons");
  });
});
