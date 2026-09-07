/*
 * Entry point of the reminders Function App: one daily timer trigger, thin, calling
 * runReminders(), which decides whether today is Monday (snack reminder) or Thursday (team
 * reminder). Lives in its own Function App because Static Web Apps Free runs HTTP triggers only.
 */
import { app, type InvocationContext, type Timer } from "@azure/functions";
import { loadConfig, localDateIso, sendEmail, withData } from "@soccer/shared";
import { runReminders } from "./lib.js";

app.timer("send-reminders", {
  // 14:00 UTC daily = 10:00 US Eastern in summer, 09:00 in winter: morning, before the shops open.
  schedule: "0 0 14 * * *",
  handler: async (_timer: Timer, context: InvocationContext) => {
    const config = loadConfig();
    const now = new Date();
    await withData((repo) =>
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
  },
});
