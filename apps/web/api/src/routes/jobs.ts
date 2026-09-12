import { app, type HttpRequest, type InvocationContext } from "@azure/functions";
import { loadConfig, localDateIso, runReminders, sendEmail, withData } from "@soccer/shared";
import { json, toErrorResponse } from "../lib/http.js";
import { requireJobKey } from "../lib/jobs.js";

// Called once a day by the Logic App in infra/main.bicep. Idempotent: reminders are keyed on the
// claim and the game, so an extra call (a retry, a manual run) sends nothing twice.
app.http("jobs-reminders", {
  route: "jobs/reminders",
  methods: ["POST"],
  authLevel: "anonymous", // the shared secret is the guard; SWA roles do not apply to a Logic App
  handler: async (request: HttpRequest, context: InvocationContext) => {
    try {
      const config = loadConfig();
      requireJobKey(request.headers.get("x-job-key"), config.JOB_KEY);
      const now = new Date();
      const summary = await withData((repo) =>
        runReminders(repo, {
          now,
          today: localDateIso(now, config.TIMEZONE),
          teamName: config.TEAM_NAME,
          siteUrl: config.SITE_URL,
          coachEmail: config.COACH_EMAIL,
          sendEmail,
          log: (line) => context.log(line),
        }),
      );
      return json(200, summary);
    } catch (error) {
      return toErrorResponse(error, context);
    }
  },
});
