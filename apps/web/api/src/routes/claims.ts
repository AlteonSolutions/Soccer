import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import {
  claimInputSchema,
  loadConfig,
  emailBranding,
  loadSettings,
  localDateIso,
  sendEmail,
  withData,
} from "@soccer/shared";
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
      const result = await withData(async (repo) => {
        const settings = await loadSettings(repo, config.TEAM_NAME);
        return createClaim(repo, input, {
          now,
          today: localDateIso(now, config.TIMEZONE),
          ...emailBranding(settings, settings.team_name, config.SITE_URL),
          coachEmail: settings.coach_email || config.COACH_EMAIL,
          allergies: settings.allergies,
          templates: settings.templates,
          sendEmail,
          log: (line) => context.log(line),
        });
      });
      return json(201, result);
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});
