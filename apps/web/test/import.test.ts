import { createMemoryRepo } from "@soccer/shared";
import { describe, expect, it } from "vitest";
import { importGames, previewImport } from "../api/src/lib/import.js";
import { claim, game } from "../../../packages/shared/test/fixtures.js";

const parsed = {
  games: [
    { date: "2026-09-19", kickoff: "11:50", opponent: "Red Dragons" }, // same id as the fixture game, new time
    { date: "2026-09-26", kickoff: "10:40", opponent: "Everton" },
  ],
  skipped: ["10/17/2026 TBD Manchester City versus Arsenal"],
};

describe("previewImport", () => {
  it("labels each parsed game new, unchanged, or changed against the schedule, and passes skipped lines through", async () => {
    const repo = createMemoryRepo({ games: [game({ kickoff: "10:00" })] });
    const preview = await previewImport(repo, parsed);
    expect(preview.games.map((g) => [g.id, g.status])).toEqual([
      ["2026-09-19-red-dragons", "changed"],
      ["2026-09-26-everton", "new"],
    ]);
    expect(preview.skipped).toEqual(parsed.skipped);
    const same = await previewImport(
      createMemoryRepo({ games: [game({ kickoff: "11:50" })] }),
      parsed,
    );
    expect(same.games[0]?.status).toBe("unchanged");
  });
});

describe("importGames", () => {
  it("updates a game in place, keeping its sign-up and its Thursday-announced mark", async () => {
    const repo = createMemoryRepo({
      games: [game({ kickoff: "10:00", team_reminded_at: "2026-09-17T14:00:00.000Z" })],
      claims: [claim()],
    });
    const written = await importGames(repo, parsed.games);
    expect(written).toHaveLength(2);
    const updated = await repo.getGame(game().id);
    expect(updated?.kickoff).toBe("11:50");
    expect(updated?.team_reminded_at).toBe("2026-09-17T14:00:00.000Z");
    expect((await repo.getClaim(game().id))?.player).toBe("Leo Rivera");
    expect((await repo.getGame("2026-09-26-everton"))?.team_reminded_at).toBeNull();
  });
});
