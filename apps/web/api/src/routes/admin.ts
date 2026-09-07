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

const PRINCIPAL_HEADER = "x-ms-client-principal";

app.http("admin-games", {
  route: "admin/games",
  methods: ["GET", "POST"],
  authLevel: "anonymous", // SWA route rules gate /api/admin/*; requireAdmin is the second check.
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
  route: "admin/games/{id}",
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
  route: "admin/claims/{gameId}",
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
  route: "admin/roster",
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
  route: "admin/roster/{player}",
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
