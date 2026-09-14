/*
 * The daily reminder run as a function of (repo, sendEmail, clock, settings). Called by the
 * jobs/reminders route and directly by tests. The run fires every day; this decides what the day
 * calls for:
 *   Monday   – the family on this week's snack claim gets a reminder (the template's To/BCC lines
 *              say who, by default the parents on the team list as of today); the coach gets a
 *              nudge if a game this week has nobody and the nudge has somewhere to go.
 *   Thursday – the team reminder about Saturday's game, by default To the coach and BCC every
 *              parent on the team list, so no family sees another's address.
 * Rules it exists to enforce: each email goes out at most once per game (`reminded_at`,
 * `team_reminded_at`), and one failed send never stops the rest of the run.
 */
import {
  recipientCount,
  reminderEmail,
  selectSnackReminders,
  selectTeamReminders,
  selectUnclaimed,
  SNACK_REMINDER_WEEKDAY,
  TEAM_REMINDER_WEEKDAY,
  teamReminderEmail,
  unclaimedNudgeEmail,
  weekdayOf,
  type DataRepo,
  type EmailTemplates,
  type SendEmail,
} from "./index.js";

export interface RunContext {
  today: string;
  now: Date;
  teamName: string;
  siteUrl: string;
  /** The coach's allergy list, for the emails that mention it. */
  allergies: string;
  /** The coach's email copy, from the site settings. */
  templates: EmailTemplates;
  /** Where {{coach}} goes: the settings' coach email, else COACH_EMAIL, else nobody. */
  coachEmail: string | undefined;
  sendEmail: SendEmail;
  log: (line: string) => void;
}

export interface RunSummary {
  day: "monday" | "thursday" | "other";
  snack_reminders_sent: number;
  snack_reminders_failed: number;
  team_reminders_sent: number;
  team_reminders_failed: number;
  unclaimed_games: number;
  coach_nudged: boolean;
}

export async function runReminders(repo: DataRepo, ctx: RunContext): Promise<RunSummary> {
  const weekday = weekdayOf(ctx.today);
  const summary: RunSummary = {
    day:
      weekday === SNACK_REMINDER_WEEKDAY
        ? "monday"
        : weekday === TEAM_REMINDER_WEEKDAY
          ? "thursday"
          : "other",
    snack_reminders_sent: 0,
    snack_reminders_failed: 0,
    team_reminders_sent: 0,
    team_reminders_failed: 0,
    unclaimed_games: 0,
    coach_nudged: false,
  };

  if (summary.day === "monday") {
    const [games, claims, roster] = await Promise.all([
      repo.listGames(),
      repo.listClaims(),
      repo.listRoster(),
    ]);
    for (const { game, claim } of selectSnackReminders(games, claims, ctx.today)) {
      // Addresses are resolved from the team list now, not at sign-up, so a corrected email
      // counts. A claim whose template resolves to nobody (the player left the team) is logged
      // and retried next Monday; a failed send likewise.
      const message = reminderEmail(game, claim, ctx, roster);
      if (recipientCount(message) === 0) {
        summary.snack_reminders_failed += 1;
        ctx.log(
          JSON.stringify({
            event: "reminder.no_recipient",
            game_id: game.id,
            player: claim.player,
          }),
        );
        continue;
      }
      try {
        await ctx.sendEmail(message);
        await repo.markReminded(game.id, ctx.now.toISOString());
        summary.snack_reminders_sent += 1;
        ctx.log(
          JSON.stringify({
            event: "reminder.sent",
            game_id: game.id,
            recipients: recipientCount(message),
          }),
        );
      } catch (error) {
        summary.snack_reminders_failed += 1;
        ctx.log(
          JSON.stringify({ event: "reminder.failed", game_id: game.id, detail: String(error) }),
        );
      }
    }
    const unclaimed = selectUnclaimed(games, claims, ctx.today);
    summary.unclaimed_games = unclaimed.length;
    if (unclaimed.length > 0) {
      const nudge = unclaimedNudgeEmail(unclaimed, ctx, roster);
      if (recipientCount(nudge) > 0) {
        try {
          await ctx.sendEmail(nudge);
          summary.coach_nudged = true;
        } catch (error) {
          ctx.log(JSON.stringify({ event: "nudge.failed", detail: String(error) }));
        }
      }
    }
  }

  if (summary.day === "thursday") {
    const [games, claims, roster] = await Promise.all([
      repo.listGames(),
      repo.listClaims(),
      repo.listRoster(),
    ]);
    const claimByGame = new Map(claims.map((c) => [c.game_id, c]));
    for (const game of selectTeamReminders(games, ctx.today)) {
      const claim = claimByGame.get(game.id);
      const message = teamReminderEmail(game, claim, ctx, roster);
      const count = recipientCount(message);
      try {
        if (count > 0) await ctx.sendEmail(message);
        summary.team_reminders_sent += count;
      } catch (error) {
        summary.team_reminders_failed += count;
        ctx.log(
          JSON.stringify({
            event: "team_reminder.failed",
            game_id: game.id,
            detail: String(error),
          }),
        );
      }
      // Marked whether or not the send went through: a bounce must not re-send to everyone.
      await repo.markTeamReminded(game.id, ctx.now.toISOString());
      ctx.log(JSON.stringify({ event: "team_reminder.sent", game_id: game.id, recipients: count }));
    }
  }

  ctx.log(JSON.stringify({ event: "reminders.run", ...summary }));
  return summary;
}
