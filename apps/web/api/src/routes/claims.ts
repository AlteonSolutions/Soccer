import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { claimInputSchema, loadConfig, localDateIso, sendEmail, withData } from "@soccer/shared";
import { createClaim } from "../lib/claims.js";
import { json, parseBody, toErrorResponse } from "../lib/http.js";

app.http("claims", {
  route: "claims",
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      const config = loadConfig();
      const input = await parseBody(request, claimInputSchema);
      const now = new Date();
      const result = await withData((repo) =>
        createClaim(repo, input, {
          now,
          today: localDateIso(now, config.TIMEZONE),
          teamName: config.TEAM_NAME,
          siteUrl: config.SITE_URL,
          sendEmail,
          log: (line) => context.log(line),
        }),
      );
      return json(201, result);
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});
