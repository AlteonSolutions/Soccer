import { describe, expect, it } from "vitest";
import { createMemoryRepo } from "../src/data-memory.js";
import { assetUrlFor, emailBranding, loadSettings, resolveSettings } from "../src/settings.js";
import { DEFAULT_TEMPLATES } from "../src/templates.js";

describe("resolveSettings", () => {
  it("falls back to TEAM_NAME, no allergy note, the default templates and no badge", () => {
    expect(resolveSettings(undefined, "Our Team")).toEqual({
      team_name: "Our Team",
      coach_email: "",
      allergies: "",
      templates: DEFAULT_TEMPLATES,
      logo_updated_at: null,
      wordmark_updated_at: null,
    });
  });

  it("keeps stored values and fills what a stored row does not have, template field by field", () => {
    const stored = {
      team_name: "Manchester City",
      allergies: "No peanuts.",
      logo_updated_at: "2026-09-14T10:00:00.000Z",
      // Saved before To/BCC and coach_email existed.
      templates: { team_reminder: { subject: "Saturday!", text: "Game {{game}}." } },
    };
    const settings = resolveSettings(stored, "Our Team");
    expect(settings.team_name).toBe("Manchester City");
    expect(settings.coach_email).toBe("");
    expect(settings.allergies).toBe("No peanuts.");
    expect(settings.templates.team_reminder.subject).toBe("Saturday!");
    expect(settings.templates.team_reminder.to).toBe("{{coach}}");
    expect(settings.templates.team_reminder.bcc).toBe("{{team_parents}}");
    expect(settings.templates.snack_reminder).toEqual(DEFAULT_TEMPLATES.snack_reminder);
    expect(assetUrlFor(settings, "logo")).toBe("/api/assets/logo?v=2026-09-14T10%3A00%3A00.000Z");
    expect(assetUrlFor(settings, "wordmark")).toBeNull();
  });

  it("ignores a corrupt row rather than failing the public page", () => {
    expect(resolveSettings({ team_name: "" }, "Our Team").team_name).toBe("Our Team");
    expect(assetUrlFor(resolveSettings("garbage", "Our Team"), "logo")).toBeNull();
  });

  it("loads through the repo", async () => {
    const repo = createMemoryRepo();
    expect((await loadSettings(repo, "Our Team")).team_name).toBe("Our Team");
    await repo.putSettings({ ...resolveSettings(undefined, "x"), team_name: "Stored" });
    expect((await loadSettings(repo, "Our Team")).team_name).toBe("Stored");
  });

  it("builds absolute badge and logo URLs for emails, with the built-in badge as the fallback", () => {
    const plain = resolveSettings(undefined, "Our Team");
    expect(emailBranding(plain, "Our Team", "https://example.org/")).toEqual({
      teamName: "Our Team",
      siteUrl: "https://example.org/",
      badgeUrl: "https://example.org/logo.svg",
      wordmarkUrl: null,
    });
    const branded = {
      ...plain,
      logo_updated_at: "2026-09-14T10:00:00.000Z",
      wordmark_updated_at: "2026-09-15T10:00:00.000Z",
    };
    expect(emailBranding(branded, "Snack City", "https://example.org")).toEqual({
      teamName: "Snack City",
      siteUrl: "https://example.org",
      badgeUrl: "https://example.org/api/assets/logo?v=2026-09-14T10%3A00%3A00.000Z",
      wordmarkUrl: "https://example.org/api/assets/wordmark?v=2026-09-15T10%3A00%3A00.000Z",
    });
  });
});
