import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import {
  bulkGamesInputSchema,
  gameIdSchema,
  loadConfig,
  newGameInputSchema,
  parseRosterText,
  parseScheduleText,
  rosterInputSchema,
  rosterMemberUpdateSchema,
  settingsInputSchema,
  emailPreviewInputSchema,
  loadSettings,
  localDateIso,
  withData,
} from "@soccer/shared";
import { z } from "zod";
import {
  addGame,
  addRosterMembers,
  updateGame,
  listAdminGames,
  listRoster,
  releaseClaim,
  removeGame,
  removeRosterMember,
  updateRosterMember,
} from "../lib/admin.js";
import { json, parseBody, parseParam, toErrorResponse } from "../lib/http.js";
import { importGames, previewImport, previewRosterImport } from "../lib/import.js";
import { extractPdfText } from "../lib/schedule-pdf.js";
import { requireAdmin } from "../lib/principal.js";
import { getSettings, previewEmail, putLogo, removeLogo, updateSettings } from "../lib/settings.js";

// Routes are "coach/…", not "admin/…": Static Web Apps forwards /api/* to the Functions host with
// the prefix stripped, and the host reserves /admin/* for its own management endpoints, so an
// "admin/games" route is unreachable (a bare 404) however it is registered. Learned on first deploy.
const PRINCIPAL_HEADER = "x-ms-client-principal";

app.http("admin-games", {
  route: "coach/games",
  methods: ["GET", "POST"],
  authLevel: "anonymous", // requireAdmin is the gate; it reads the principal header SWA sets.
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      requireAdmin(request.headers.get(PRINCIPAL_HEADER));
      if (request.method === "GET") return json(200, { games: await withData(listAdminGames) });
      const input = await parseBody(request, newGameInputSchema);
      return json(201, await withData((repo) => addGame(repo, input)));
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});

app.http("admin-game", {
  route: "coach/games/{id}",
  methods: ["DELETE"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      requireAdmin(request.headers.get(PRINCIPAL_HEADER));
      const id = parseParam(request.params.id, gameIdSchema, "game id");
      await withData((repo) => removeGame(repo, id));
      return json(204, undefined);
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});

app.http("admin-claim", {
  route: "coach/claims/{gameId}",
  methods: ["DELETE"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      requireAdmin(request.headers.get(PRINCIPAL_HEADER));
      const gameId = parseParam(request.params.gameId, gameIdSchema, "game id");
      await withData((repo) => releaseClaim(repo, gameId));
      return json(204, undefined);
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});

app.http("admin-roster", {
  route: "coach/roster",
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      requireAdmin(request.headers.get(PRINCIPAL_HEADER));
      if (request.method === "GET") return json(200, { members: await withData(listRoster) });
      const input = await parseBody(request, rosterInputSchema);
      return json(201, {
        members: await withData((repo) => addRosterMembers(repo, input, new Date())),
      });
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});

app.http("admin-roster-member", {
  route: "coach/roster/{player}",
  methods: ["DELETE"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      requireAdmin(request.headers.get(PRINCIPAL_HEADER));
      const player = parseParam(
        decodeURIComponent(request.params.player ?? ""),
        z.string().trim().min(1).max(60),
        "player",
      );
      await withData((repo) => removeRosterMember(repo, player));
      return json(204, undefined);
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});

// Step one of the import: the PDF's bytes in, a preview out. Nothing is written.
app.http("coach-schedule-parse", {
  route: "coach/schedule/parse",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      requireAdmin(request.headers.get(PRINCIPAL_HEADER));
      const { TEAM_NAME } = loadConfig();
      const text = await extractPdfText(new Uint8Array(await request.arrayBuffer()));
      return json(
        200,
        await withData(async (repo) => {
          // The schedule PDF lists both teams per game; ours is the name in the settings.
          const { team_name } = await loadSettings(repo, TEAM_NAME);
          return previewImport(repo, parseScheduleText(text, team_name));
        }),
      );
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});

// Step two: the coach confirmed the preview; write those games.
app.http("coach-games-bulk", {
  route: "coach/games/bulk",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      requireAdmin(request.headers.get(PRINCIPAL_HEADER));
      const input = await parseBody(request, bulkGamesInputSchema);
      const written = await withData((repo) => importGames(repo, input.games));
      return json(201, { imported: written.length });
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});

app.http("coach-game-edit", {
  route: "coach/games/{id}",
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      requireAdmin(request.headers.get(PRINCIPAL_HEADER));
      const id = parseParam(request.params.id, gameIdSchema, "game id");
      const input = await parseBody(request, newGameInputSchema);
      return json(200, await withData((repo) => updateGame(repo, id, input)));
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});

// Roster import, same two steps as the schedule: preview from the PDF, then the existing
// POST coach/roster writes the confirmed members.
app.http("coach-roster-parse", {
  route: "coach/roster/parse",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      requireAdmin(request.headers.get(PRINCIPAL_HEADER));
      const text = await extractPdfText(new Uint8Array(await request.arrayBuffer()));
      const parsed = parseRosterText(text);
      return json(200, await withData((repo) => previewRosterImport(repo, parsed)));
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});

app.http("coach-roster-edit", {
  route: "coach/roster/{player}",
  methods: ["PUT"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      requireAdmin(request.headers.get(PRINCIPAL_HEADER));
      const player = parseParam(
        decodeURIComponent(request.params.player ?? ""),
        z.string().trim().min(1).max(60),
        "player",
      );
      const input = await parseBody(request, rosterMemberUpdateSchema);
      return json(200, {
        members: await withData((repo) => updateRosterMember(repo, player, input)),
      });
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});

// ---- Site settings: team name, allergy note, email templates, and the badge.
app.http("coach-settings", {
  route: "coach/settings",
  methods: ["GET", "PUT"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      requireAdmin(request.headers.get(PRINCIPAL_HEADER));
      const { TEAM_NAME } = loadConfig();
      if (request.method === "GET") {
        return json(200, await withData((repo) => getSettings(repo, TEAM_NAME)));
      }
      const input = await parseBody(request, settingsInputSchema);
      return json(200, await withData((repo) => updateSettings(repo, TEAM_NAME, input)));
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});

// The badge: the browser sends the file's bytes with its own content type. DELETE goes back to
// the built-in badge.
app.http("coach-logo", {
  route: "coach/logo",
  methods: ["POST", "DELETE"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      requireAdmin(request.headers.get(PRINCIPAL_HEADER));
      const { TEAM_NAME } = loadConfig();
      if (request.method === "DELETE") {
        return json(200, await withData((repo) => removeLogo(repo, TEAM_NAME)));
      }
      const bytes = new Uint8Array(await request.arrayBuffer());
      const type = request.headers.get("content-type");
      return json(200, await withData((repo) => putLogo(repo, TEAM_NAME, type, bytes, new Date())));
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});

// Render a template as typed, before it is saved, with values from the next real game.
app.http("coach-settings-preview", {
  route: "coach/settings/preview",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      requireAdmin(request.headers.get(PRINCIPAL_HEADER));
      const config = loadConfig();
      const input = await parseBody(request, emailPreviewInputSchema);
      const today = localDateIso(new Date(), config.TIMEZONE);
      return json(
        200,
        await withData((repo) =>
          previewEmail(repo, input, config.SITE_URL, config.TEAM_NAME, config.COACH_EMAIL, today),
        ),
      );
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});
