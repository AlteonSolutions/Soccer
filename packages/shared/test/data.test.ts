import { connect } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withData } from "../src/data.js";
import { loadSettings } from "../src/settings.js";
import { DEFAULT_TEMPLATES } from "../src/templates.js";
import type { Settings } from "../src/schemas.js";
import { claim, game } from "./fixtures.js";

// Runs against Azurite's table endpoint when it is up (`pnpm run dev:storage`) and skips itself
// otherwise, so the gate passes on a fresh clone and still exercises the real repo where it can.
async function azuriteUp(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: "127.0.0.1", port: 10002 });
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });
}

describe("withData against Azurite", async () => {
  const up = await azuriteUp();
  const run = up ? it : it.skip;
  const suffix = Date.now().toString(36);
  const testGame = game({ id: `2026-09-19-azurite-${suffix}` });
  const testClaim = claim({ game_id: testGame.id });

  beforeAll(() => {
    if (!up) console.info("Azurite not reachable on 127.0.0.1:10002; skipping Table Storage tests");
  });
  afterAll(async () => {
    if (!up) return;
    await withData(async (repo) => {
      await repo.deleteClaim(testGame.id);
      await repo.deleteGame(testGame.id);
    });
  });

  run(
    "round-trips a game and a claim, enforces one claim per game, and merges the reminded columns",
    async () => {
      await withData((repo) => repo.putGame(testGame));
      expect(await withData((repo) => repo.getGame(testGame.id))).toEqual(testGame);

      await withData((repo) => repo.createClaim(testClaim));
      // A fresh claim has no reminded_at column in storage; it must read back as null, not fail.
      expect((await withData((repo) => repo.getClaim(testGame.id)))?.reminded_at).toBeNull();
      const listed = await withData((repo) => repo.listClaims());
      expect(listed.find((c) => c.game_id === testGame.id)?.reminded_at).toBeNull();
      await expect(
        withData((repo) => repo.createClaim({ ...testClaim, player: "Other" })),
      ).rejects.toMatchObject({
        code: "ALREADY_CLAIMED",
      });

      await withData((repo) => repo.markReminded(testGame.id, "2026-09-14T14:00:00.000Z"));
      const stored = await withData((repo) => repo.getClaim(testGame.id));
      expect(stored?.reminded_at).toBe("2026-09-14T14:00:00.000Z");
      expect(stored?.player).toBe("Leo Rivera");

      const games = await withData((repo) => repo.listGames());
      expect(games.some((g) => g.id === testGame.id)).toBe(true);
      expect(await withData((repo) => repo.getGame("2026-01-01-nope"))).toBeUndefined();

      // A fresh game has no team_reminded_at column either; merge must set it and keep the rest.
      expect((await withData((repo) => repo.getGame(testGame.id)))?.team_reminded_at).toBeNull();
      await withData((repo) => repo.markTeamReminded(testGame.id, "2026-09-17T14:00:00.000Z"));
      const told = await withData((repo) => repo.getGame(testGame.id));
      expect(told?.team_reminded_at).toBe("2026-09-17T14:00:00.000Z");
      expect(told?.opponent).toBe(testGame.opponent);
    },
  );

  run(
    "keys roster members by player, including row-key-unsafe names, and replaces on re-add",
    async () => {
      const odd = `Weird#Name?${suffix}`;
      const plain = `Plain ${suffix}`;
      const added_at = "2026-09-01T00:00:00.000Z";
      try {
        await withData((repo) =>
          repo.addRosterMembers([
            { player: odd, emails: ["odd@example.com"], added_at, position: 7 },
            { player: plain, emails: ["plain@example.com"], added_at, position: 8 },
          ]),
        );
        await withData((repo) =>
          repo.addRosterMembers([
            {
              player: plain.toUpperCase(),
              emails: ["corrected@example.com"],
              added_at,
              position: 8,
            },
          ]),
        );
        expect((await withData((repo) => repo.getRosterMember(odd)))?.emails).toEqual([
          "odd@example.com",
        ]);
        expect((await withData((repo) => repo.getRosterMember(plain)))?.emails).toEqual([
          "corrected@example.com",
        ]);
        const all = await withData((repo) => repo.listRoster());
        expect(all.filter((m) => m.emails.includes("corrected@example.com"))).toHaveLength(1);
      } finally {
        await withData((repo) => repo.removeRosterMember(odd));
        await withData((repo) => repo.removeRosterMember(plain));
      }
      expect(await withData((repo) => repo.getRosterMember(odd))).toBeUndefined();
    },
  );

  run("round-trips the settings row and the badge blob", async () => {
    const settings = {
      team_name: `Azurite FC ${suffix}`,
      coach_email: "coach@example.com",
      allergies: "No peanuts.",
      templates: {
        ...DEFAULT_TEMPLATES,
        coach_nudge: { to: "{{coach}}", bcc: "", subject: "s", text: "t" },
      },
      logo_updated_at: "2026-09-14T10:00:00.000Z",
      wordmark_updated_at: null,
    };
    await withData((repo) => repo.putSettings(settings));
    // Through the resolver: Table Storage drops the null wordmark column and the resolver restores it.
    expect(await withData((repo) => loadSettings(repo, "Fallback"))).toEqual(settings);

    const logo = {
      content_type: "image/png",
      bytes: new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
      updated_at: settings.logo_updated_at,
    };
    await withData((repo) => repo.putLogo("logo", logo));
    expect(await withData((repo) => repo.getLogo("logo"))).toEqual(logo);
    expect(await withData((repo) => repo.getLogo("wordmark"))).toBeUndefined();
    await withData((repo) => repo.deleteLogo("logo"));
    expect(await withData((repo) => repo.getLogo("logo"))).toBeUndefined();

    // The first save on the live site: no badge (null), no allergies (""). Table Storage stores
    // neither as a column, and the read must still succeed with the defaults.
    const fresh = { ...settings, coach_email: "", allergies: "", logo_updated_at: null };
    await withData((repo) => repo.putSettings(fresh));
    // Read through the resolver: the repo hands the row back as stored (no null column).
    expect(await withData((repo) => loadSettings(repo, "Fallback"))).toEqual(fresh);

    // A row saved by an older version: templates without To/BCC, no coach_email column. The
    // repo hands it back as stored and resolveSettings fills the gaps; the site stayed up.
    const older = {
      team_name: `Older ${suffix}`,
      allergies: "",
      logo_updated_at: null,
      templates: { team_reminder: { subject: "Saturday!", text: "Game {{game}}." } },
    } as unknown as Settings;
    await withData((repo) => repo.putSettings(older));
    const resolved = await withData((repo) => loadSettings(repo, "Fallback"));
    expect(resolved.team_name).toBe(`Older ${suffix}`);
    expect(resolved.coach_email).toBe("");
    expect(resolved.templates.team_reminder).toEqual({
      ...DEFAULT_TEMPLATES.team_reminder,
      subject: "Saturday!",
      text: "Game {{game}}.",
    });
    expect(resolved.templates.snack_reminder).toEqual(DEFAULT_TEMPLATES.snack_reminder);
  });
});
