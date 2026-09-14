import { createMemoryRepo, DEFAULT_TEMPLATES } from "@soccer/shared";
import { describe, expect, it } from "vitest";
import {
  getSettings,
  MAX_LOGO_BYTES,
  previewEmail,
  putLogo,
  removeLogo,
  updateSettings,
} from "../api/src/lib/settings.js";
import { claim, game, member } from "../../../packages/shared/test/fixtures.js";

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

describe("previewEmail", () => {
  it("fills the template as typed from the next game and its sign-up, without saving it", async () => {
    const repo = createMemoryRepo({
      games: [game({ id: "2026-09-12-past", date: "2026-09-12", opponent: "Past" }), game()],
      claims: [claim()],
      roster: [member({ player: "Mia Chen" })],
    });
    const preview = await previewEmail(
      repo,
      {
        team_name: "Snack City",
        kind: "snack_reminder",
        template: { subject: "{{team}} snacks {{date}}", text: "{{player}} vs {{opponent}}" },
      },
      "https://example.org",
      "Our Team",
      "2026-09-14",
    );
    expect(preview.subject).toBe("Snack City snacks 9/19");
    expect(preview.text).toBe("Leo Rivera vs Red Dragons");
    expect(preview.based_on).toEqual({ game: "9/19 vs Red Dragons", player: "Leo Rivera" });
    expect((await getSettings(repo, "Our Team")).settings.templates).toEqual(DEFAULT_TEMPLATES);
  });

  it("falls back to the first player, then to a sample game, when there is nothing to show", async () => {
    const withRoster = await previewEmail(
      createMemoryRepo({ games: [game()], roster: [member({ player: "Mia Chen" })] }),
      {
        team_name: "T",
        kind: "claim_confirmation",
        template: { subject: "s", text: "{{player}}" },
      },
      "https://example.org",
      "Our Team",
      "2026-09-14",
    );
    expect(withRoster.text).toBe("Mia Chen");
    const empty = await previewEmail(
      createMemoryRepo(),
      {
        team_name: "T",
        kind: "coach_nudge",
        template: { subject: "{{count}}", text: "{{games}}" },
      },
      "https://example.org",
      "Our Team",
      "2026-09-14",
    );
    expect(empty.subject).toBe("1");
    expect(empty.text).toContain("Red Dragons");
    expect(empty.based_on.player).toBe("Leo Rivera");
  });
});
