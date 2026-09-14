import { describe, expect, it } from "vitest";
import { EMAIL_KINDS } from "../src/schemas.js";
import { confirmationEmail, unclaimedNudgeEmail } from "../src/snacks.js";
import {
  DEFAULT_TEMPLATES,
  renderTemplate,
  resolveRecipients,
  TEMPLATE_PLACEHOLDERS,
} from "../src/templates.js";
import { claim, game, member } from "./fixtures.js";

describe("renderTemplate", () => {
  it("fills known placeholders, tolerates spaces, and leaves unknown ones visible", () => {
    const out = renderTemplate(
      { to: "", bcc: "", subject: "{{team}}: {{ date }}", text: "Hi {{player}}, see {{typo}}." },
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
      coachEmail: undefined,
      allergies: "",
      templates: {
        ...DEFAULT_TEMPLATES,
        claim_confirmation: {
          ...DEFAULT_TEMPLATES.claim_confirmation,
          subject: "Snacks on {{date}} – thank you!",
          text: "{{player}} vs {{opponent}} at {{kickoff}}. {{site_url}}",
        },
      },
    };
    const copy = confirmationEmail(game(), claim(), site, [member()]);
    expect(copy.subject).toBe("Snacks on 9/19 – thank you!");
    expect(copy.text).toBe("Leo Rivera vs Red Dragons at 10:00 AM. https://example.org");
    const nudge = unclaimedNudgeEmail([game()], site, [member()]);
    expect(nudge.subject).toBe("City: 1 upcoming game(s) with no snack sign-up");
    expect(nudge.text).toContain("  - 9/19 at 10:00 AM vs Red Dragons");
  });
});

describe("resolveRecipients", () => {
  const vars = {
    parents: ["sam@example.com", "dad@example.com"],
    team_parents: ["sam@example.com", "dad@example.com", "chen@example.com"],
    coach: ["coach@example.com"],
  };
  const template = (to: string, bcc: string) => ({ to, bcc, subject: "s", text: "t" });

  it("expands placeholders, keeps literal addresses, and de-duplicates", () => {
    expect(resolveRecipients(template("{{parents}}, Helper@Example.com", ""), vars)).toEqual({
      to: ["sam@example.com", "dad@example.com", "helper@example.com"],
      bcc: [],
    });
  });

  it("drops from BCC anyone already in To, so nobody gets two copies", () => {
    expect(resolveRecipients(template("{{coach}}, {{parents}}", "{{team_parents}}"), vars)).toEqual(
      {
        to: ["coach@example.com", "sam@example.com", "dad@example.com"],
        bcc: ["chen@example.com"],
      },
    );
  });

  it("an empty placeholder (no coach, no parents) resolves to nobody rather than failing", () => {
    expect(
      resolveRecipients(template("{{coach}}", "{{parents}}"), { ...vars, coach: [], parents: [] }),
    ).toEqual({
      to: [],
      bcc: [],
    });
  });
});
