import { describe, expect, it } from "vitest";
import { createMemoryRepo } from "../src/data-memory.js";
import { loadSettings, logoUrlFor, resolveSettings } from "../src/settings.js";
import { DEFAULT_TEMPLATES } from "../src/templates.js";

describe("resolveSettings", () => {
  it("falls back to TEAM_NAME, no allergy note, the default templates and no badge", () => {
    expect(resolveSettings(undefined, "Our Team")).toEqual({
      team_name: "Our Team",
      allergies: "",
      templates: DEFAULT_TEMPLATES,
      logo_updated_at: null,
    });
  });

  it("keeps stored values and fills templates a stored row does not have", () => {
    const stored = {
      team_name: "Manchester City",
      allergies: "No peanuts.",
      logo_updated_at: "2026-09-14T10:00:00.000Z",
      templates: { team_reminder: { subject: "Saturday!", text: "Game {{game}}." } },
    };
    const settings = resolveSettings(stored, "Our Team");
    expect(settings.team_name).toBe("Manchester City");
    expect(settings.allergies).toBe("No peanuts.");
    expect(settings.templates.team_reminder.subject).toBe("Saturday!");
    expect(settings.templates.snack_reminder).toEqual(DEFAULT_TEMPLATES.snack_reminder);
    expect(logoUrlFor(settings)).toBe("/api/logo?v=2026-09-14T10%3A00%3A00.000Z");
  });

  it("ignores a corrupt row rather than failing the public page", () => {
    expect(resolveSettings({ team_name: "" }, "Our Team").team_name).toBe("Our Team");
    expect(logoUrlFor(resolveSettings("garbage", "Our Team"))).toBeNull();
  });

  it("loads through the repo", async () => {
    const repo = createMemoryRepo();
    expect((await loadSettings(repo, "Our Team")).team_name).toBe("Our Team");
    await repo.putSettings({ ...resolveSettings(undefined, "x"), team_name: "Stored" });
    expect((await loadSettings(repo, "Our Team")).team_name).toBe("Stored");
  });
});
