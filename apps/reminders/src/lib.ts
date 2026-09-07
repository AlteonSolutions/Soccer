/*
 * The daily reminder run as a function of (repo, sendEmail, clock, config). Called by the timer
 * trigger in index.ts and directly by tests. The timer fires every day; this decides what the day
 * calls for:
 *   Monday   — the family on snacks for this week's game gets a reminder; the coach gets a nudge
 *              if a game this week has nobody (only when COACH_EMAIL is set).
 *   Thursday — every family on the roster gets a reminder about Saturday's game.
 * Rules it exists to enforce: each email goes out at most once per game (`reminded_at`,
 * `team_reminded_at`), and one failed send never stops the rest of the run.
 */
import {
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
  type SendEmail,
} from "@soccer/shared";

export interface RunContext {
  today: string;
  now: Date;
  teamName: string;
  siteUrl: string;
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
    const [games, claims] = await Promise.all([repo.listGames(), repo.listClaims()]);
    for (const { game, claim } of selectSnackReminders(games, claims, ctx.today)) {
      try {
        await ctx.sendEmail({
          to: claim.email,
          ...reminderEmail(game, claim, ctx.teamName, ctx.siteUrl),
        });
        await repo.markReminded(game.id, ctx.now.toISOString());
        summary.snack_reminders_sent += 1;
        ctx.log(JSON.stringify({ event: "reminder.sent", game_id: game.id }));
      } catch (error) {
        summary.snack_reminders_failed += 1;
        ctx.log(
          JSON.stringify({ event: "reminder.failed", game_id: game.id, detail: String(error) }),
        );
      }
    }
    const unclaimed = selectUnclaimed(games, claims, ctx.today);
    summary.unclaimed_games = unclaimed.length;
    if (unclaimed.length > 0 && ctx.coachEmail) {
      try {
        await ctx.sendEmail({
          to: ctx.coachEmail,
          ...unclaimedNudgeEmail(unclaimed, ctx.teamName, ctx.siteUrl),
        });
        summary.coach_nudged = true;
      } catch (error) {
        ctx.log(JSON.stringify({ event: "nudge.failed", detail: String(error) }));
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
      const copy = teamReminderEmail(game, claimByGame.get(game.id), ctx.teamName, ctx.siteUrl);
      // One email per family: nobody sees anyone else's address.
      for (const member of roster) {
        try {
          await ctx.sendEmail({ to: member.email, ...copy });
          summary.team_reminders_sent += 1;
        } catch (error) {
          summary.team_reminders_failed += 1;
          ctx.log(
            JSON.stringify({
              event: "team_reminder.failed",
              game_id: game.id,
              detail: String(error),
            }),
          );
        }
      }
      // Marked after the whole roster is attempted: one bounced address must not re-send to everyone.
      await repo.markTeamReminded(game.id, ctx.now.toISOString());
      ctx.log(
        JSON.stringify({
          event: "team_reminder.sent",
          game_id: game.id,
          recipients: roster.length,
        }),
      );
    }
  }

  ctx.log(JSON.stringify({ event: "reminders.run", ...summary }));
  return summary;
}
