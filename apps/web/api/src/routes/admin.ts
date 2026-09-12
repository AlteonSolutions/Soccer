import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { gameIdSchema, newGameInputSchema, rosterInputSchema, withData } from "@soccer/shared";
import { z } from "zod";
import {
  addGame,
  addRosterMembers,
  listAdminGames,
  listRoster,
  releaseClaim,
  removeGame,
  removeRosterMember,
} from "../lib/admin.js";
import { json, parseBody, parseParam, toErrorResponse } from "../lib/http.js";
import { requireAdmin } from "../lib/principal.js";

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
