import { describe, expect, it } from "vitest";
import { emailTemplateSchema, recipientLineSchema } from "../src/schemas.js";

describe("recipient lines", () => {
  it("accepts placeholders and addresses in any mix, and an empty line", () => {
    for (const line of ["", "{{parents}}", "{{ coach }}, helper@example.com", "a@b.co, c@d.org"]) {
      expect(recipientLineSchema.safeParse(line).success, line).toBe(true);
    }
  });

  it("rejects unknown placeholders and things that are not addresses", () => {
    for (const line of ["{{everyone}}", "coach", "{{parents}} helper@example.com"]) {
      expect(recipientLineSchema.safeParse(line).success, line).toBe(false);
    }
  });

  it("a template needs somebody in To or BCC", () => {
    const base = { subject: "s", text: "t" };
    expect(emailTemplateSchema.safeParse({ ...base, to: "", bcc: "" }).success).toBe(false);
    expect(
      emailTemplateSchema.safeParse({ ...base, to: "", bcc: "{{team_parents}}" }).success,
    ).toBe(true);
  });
});
