import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { gameIdSchema, newGameInputSchema, withData } from "@soccer/shared";
import { addGame, listAdminGames, releaseClaim, removeGame } from "../lib/admin.js";
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
