import { createMemoryRepo, DEFAULT_TEMPLATES } from "@soccer/shared";
import { describe, expect, it } from "vitest";
import {
  getSettings,
  MAX_LOGO_BYTES,
  putLogo,
  removeLogo,
  updateSettings,
} from "../api/src/lib/settings.js";

const now = new Date("2026-09-14T10:00:00Z");

describe("settings", () => {
  it("starts from the defaults and keeps an edit", async () => {
    const repo = createMemoryRepo();
    const before = await getSettings(repo, "Our Team");
    expect(before.settings.team_name).toBe("Our Team");
    expect(before.default_templates).toEqual(DEFAULT_TEMPLATES);

    const after = await updateSettings(repo, "Our Team", {
      team_name: "Snack City",
      allergies: "No peanuts.",
      templates: {
        ...DEFAULT_TEMPLATES,
        team_reminder: { subject: "Saturday", text: "Game {{game}}. {{snacks}}" },
      },
    });
    expect(after.settings.team_name).toBe("Snack City");
    expect(after.settings.templates.team_reminder.subject).toBe("Saturday");
    expect((await getSettings(repo, "Our Team")).settings).toEqual(after.settings);
  });

  it("stores an image as the badge, stamps the version, and removes it again", async () => {
    const repo = createMemoryRepo();
    const bytes = new Uint8Array([1, 2, 3]);
    const settings = await putLogo(repo, "Our Team", "image/png", bytes, now);
    expect(settings.logo_updated_at).toBe("2026-09-14T10:00:00.000Z");
    expect(await repo.getLogo()).toEqual({
      content_type: "image/png",
      bytes,
      updated_at: "2026-09-14T10:00:00.000Z",
    });
    // A settings edit does not lose the badge.
    const edited = await updateSettings(repo, "Our Team", {
      team_name: "Edited",
      allergies: "",
      templates: DEFAULT_TEMPLATES,
    });
    expect(edited.settings.logo_updated_at).toBe("2026-09-14T10:00:00.000Z");
    const removed = await removeLogo(repo, "Our Team");
    expect(removed.logo_updated_at).toBeNull();
    expect(removed.team_name).toBe("Edited");
    expect(await repo.getLogo()).toBeUndefined();
  });

  it("rejects a non-image, an empty file, and an oversized one", async () => {
    const repo = createMemoryRepo();
    await expect(
      putLogo(repo, "Our Team", "application/pdf", new Uint8Array([1]), now),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      putLogo(repo, "Our Team", "image/png", new Uint8Array(), now),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      putLogo(repo, "Our Team", "image/png", new Uint8Array(MAX_LOGO_BYTES + 1), now),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await repo.getLogo()).toBeUndefined();
  });
});
