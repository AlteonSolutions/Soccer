import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { loadConfig, withData } from "@soccer/shared";
import { json, toErrorResponse } from "../lib/http.js";
import { getSchedule } from "../lib/schedule.js";

app.http("games", {
  route: "games",
  methods: ["GET"],
  authLevel: "anonymous",
  handler: async (_request: HttpRequest, context: InvocationContext) => {
    try {
      const { TEAM_NAME } = loadConfig();
      return json(200, await withData((repo) => getSchedule(repo, TEAM_NAME)));
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});
