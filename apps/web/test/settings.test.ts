import {
  clearCapturedEmails,
  createMemoryRepo,
  DEFAULT_TEMPLATES,
  defaultSettings,
  readCapturedEmails,
  sendEmail,
} from "@soccer/shared";
import { describe, expect, it } from "vitest";
import {
  getSettings,
  MAX_LOGO_BYTES,
  previewEmail,
  putLogo,
  removeLogo,
  sendTestEmail,
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
      coach_email: "coach@example.com",
      allergies: "No peanuts.",
      templates: {
        ...DEFAULT_TEMPLATES,
        team_reminder: {
          ...DEFAULT_TEMPLATES.team_reminder,
          subject: "Saturday",
          text: "Game {{game}}. {{snacks}}",
        },
      },
    });
    expect(after.settings.team_name).toBe("Snack City");
    expect(after.settings.templates.team_reminder.subject).toBe("Saturday");
    expect((await getSettings(repo, "Our Team")).settings).toEqual(after.settings);
  });

  it("stores an image as the badge, stamps the version, and removes it again", async () => {
    const repo = createMemoryRepo();
    const bytes = new Uint8Array([1, 2, 3]);
    const settings = await putLogo(repo, "Our Team", "logo", "image/png", bytes, now);
    expect(settings.logo_updated_at).toBe("2026-09-14T10:00:00.000Z");
    expect(settings.wordmark_updated_at).toBeNull();
    expect(await repo.getLogo("logo")).toEqual({
      content_type: "image/png",
      bytes,
      updated_at: "2026-09-14T10:00:00.000Z",
    });
    // A settings edit does not lose the badge.
    const edited = await updateSettings(repo, "Our Team", {
      team_name: "Edited",
      coach_email: "",
      allergies: "",
      templates: DEFAULT_TEMPLATES,
    });
    expect(edited.settings.logo_updated_at).toBe("2026-09-14T10:00:00.000Z");
    const removed = await removeLogo(repo, "Our Team", "logo");
    expect(removed.logo_updated_at).toBeNull();
    expect(removed.team_name).toBe("Edited");
    expect(await repo.getLogo("logo")).toBeUndefined();
  });

  it("keeps the Snack Duty logo in its own slot, separate from the badge", async () => {
    const repo = createMemoryRepo();
    const later = new Date("2026-09-15T10:00:00Z");
    await putLogo(repo, "Our Team", "logo", "image/png", new Uint8Array([1]), now);
    const settings = await putLogo(
      repo,
      "Our Team",
      "wordmark",
      "image/png",
      new Uint8Array([2]),
      later,
    );
    expect(settings.logo_updated_at).toBe("2026-09-14T10:00:00.000Z");
    expect(settings.wordmark_updated_at).toBe("2026-09-15T10:00:00.000Z");
    expect((await repo.getLogo("wordmark"))?.bytes).toEqual(new Uint8Array([2]));
    const removed = await removeLogo(repo, "Our Team", "wordmark");
    expect(removed.wordmark_updated_at).toBeNull();
    expect(removed.logo_updated_at).toBe("2026-09-14T10:00:00.000Z");
    expect(await repo.getLogo("logo")).toBeDefined();
  });

  it("rejects a non-image, an empty file, and an oversized one", async () => {
    const repo = createMemoryRepo();
    await expect(
      putLogo(repo, "Our Team", "logo", "application/pdf", new Uint8Array([1]), now),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      putLogo(repo, "Our Team", "logo", "image/png", new Uint8Array(), now),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      putLogo(repo, "Our Team", "logo", "image/png", new Uint8Array(MAX_LOGO_BYTES + 1), now),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await repo.getLogo("logo")).toBeUndefined();
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
        template: {
          to: "{{parents}}",
          bcc: "{{coach}}",
          subject: "{{team}} snacks {{date}}",
          text: "{{player}} vs {{opponent}}",
        },
      },
      "https://example.org",
      "Our Team",
      "fallback-coach@example.com",
      "2026-09-14",
    );
    expect(preview.subject).toBe("Snack City snacks 9/19");
    expect(preview.text).toBe("Leo Rivera vs Red Dragons");
    // The claim's player is Leo Rivera; only Mia Chen is on the list, so parents resolve to nobody.
    expect(preview.to).toEqual([]);
    expect(preview.bcc).toEqual(["fallback-coach@example.com"]);
    expect(preview.based_on).toEqual({ game: "9/19 vs Red Dragons", player: "Leo Rivera" });
    expect((await getSettings(repo, "Our Team")).settings.templates).toEqual(DEFAULT_TEMPLATES);
  });

  it("falls back to the first player, then to a sample game, when there is nothing to show", async () => {
    const withRoster = await previewEmail(
      createMemoryRepo({ games: [game()], roster: [member({ player: "Mia Chen" })] }),
      {
        team_name: "T",
        kind: "claim_confirmation",
        template: { to: "{{parents}}", bcc: "", subject: "s", text: "{{player}}" },
      },
      "https://example.org",
      "Our Team",
      undefined,
      "2026-09-14",
    );
    expect(withRoster.text).toBe("Mia Chen");
    expect(withRoster.to).toEqual(["sam@example.com"]);
    const empty = await previewEmail(
      createMemoryRepo(),
      {
        team_name: "T",
        kind: "coach_nudge",
        template: { to: "{{coach}}", bcc: "", subject: "{{count}}", text: "{{games}}" },
      },
      "https://example.org",
      "Our Team",
      undefined,
      "2026-09-14",
    );
    expect(empty.subject).toBe("1");
    expect(empty.text).toContain("Red Dragons");
    expect(empty.based_on.player).toBe("Leo Rivera");
  });
});

describe("sendTestEmail", () => {
  const input = {
    team_name: "Snack City",
    kind: "team_reminder" as const,
    template: {
      ...DEFAULT_TEMPLATES.team_reminder,
      to: "{{coach}}",
      bcc: "{{team_parents}}",
    },
  };

  it("sends the preview to the coach only, ignoring To and BCC, and marks nothing", async () => {
    clearCapturedEmails();
    const repo = createMemoryRepo({
      games: [game()],
      claims: [claim()],
      roster: [member({ emails: ["sam@example.com"] })],
      settings: { ...defaultSettings("Our Team"), coach_email: "coach@example.com" },
    });
    const result = await sendTestEmail(
      repo,
      input,
      "https://example.org",
      "Our Team",
      undefined,
      "2026-09-14",
      sendEmail,
    );
    expect(result.to).toBe("coach@example.com");
    const sent = readCapturedEmails();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toEqual(["coach@example.com"]);
    expect(sent[0]?.bcc).toEqual([]);
    expect(sent[0]?.text).toContain("Snacks: Leo Rivera.");
    expect((await repo.getGame(game().id))?.team_reminded_at).toBeNull();
  });

  it("falls back to COACH_EMAIL, and refuses when there is no coach address at all", async () => {
    clearCapturedEmails();
    const repo = createMemoryRepo({ games: [game()], roster: [member()] });
    const result = await sendTestEmail(
      repo,
      input,
      "https://example.org",
      "Our Team",
      "fallback@example.com",
      "2026-09-14",
      sendEmail,
    );
    expect(result.to).toBe("fallback@example.com");
    await expect(
      sendTestEmail(
        repo,
        input,
        "https://example.org",
        "Our Team",
        undefined,
        "2026-09-14",
        sendEmail,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(readCapturedEmails()).toHaveLength(1);
  });
});
