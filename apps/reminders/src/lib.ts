/*
 * The daily reminder run as a function of (repo, sendEmail, clock, config). Called by the timer
 * trigger in index.ts and directly by tests. The timer fires every day; this decides what the day
 * calls for:
 *   Monday   — the family on this week's snack claim gets a reminder, at the addresses on the team
 *              list for that player as of today; the coach gets a nudge if a game this week has
 *              nobody (only when COACH_EMAIL is set).
 *   Thursday — every parent address on the team list gets a reminder about Saturday's game.
 * Rules it exists to enforce: each email goes out at most once per game (`reminded_at`,
 * `team_reminded_at`), and one failed send never stops the rest of the run.
 */
import {
  emailsForPlayer,
  reminderEmail,
  rosterEmails,
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
    const [games, claims, roster] = await Promise.all([
      repo.listGames(),
      repo.listClaims(),
      repo.listRoster(),
    ]);
    for (const { game, claim } of selectSnackReminders(games, claims, ctx.today)) {
      // Addresses are read from the team list now, not at sign-up, so a corrected email counts.
      // The claim counts as reminded once any address accepts it, and is retried next Monday
      // only if every address failed (or the player is no longer on the list).
      const recipients = emailsForPlayer(roster, claim.player);
      if (recipients.length === 0) {
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
      const copy = reminderEmail(game, claim, ctx.teamName, ctx.siteUrl);
      let delivered = 0;
      for (const to of recipients) {
        try {
          await ctx.sendEmail({ to, ...copy });
          delivered += 1;
        } catch (error) {
          ctx.log(
            JSON.stringify({
              event: "reminder.failed",
              game_id: game.id,
              to,
              detail: String(error),
            }),
          );
        }
      }
      if (delivered > 0) {
        await repo.markReminded(game.id, ctx.now.toISOString());
        summary.snack_reminders_sent += 1;
        ctx.log(
          JSON.stringify({ event: "reminder.sent", game_id: game.id, recipients: delivered }),
        );
      } else {
        summary.snack_reminders_failed += 1;
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
      const claim = claimByGame.get(game.id);
      const copy = teamReminderEmail(game, claim, ctx.teamName, ctx.siteUrl);
      // One email per address, nobody sees anyone else's. The snack family is on the list too.
      const recipients = rosterEmails(roster);
      for (const to of recipients) {
        try {
          await ctx.sendEmail({ to, ...copy });
          summary.team_reminders_sent += 1;
        } catch (error) {
          summary.team_reminders_failed += 1;
          ctx.log(
            JSON.stringify({
              event: "team_reminder.failed",
              game_id: game.id,
              to,
              detail: String(error),
            }),
          );
        }
      }
      // Marked after the whole list is attempted: one bounced address must not re-send to everyone.
      await repo.markTeamReminded(game.id, ctx.now.toISOString());
      ctx.log(
        JSON.stringify({
          event: "team_reminder.sent",
          game_id: game.id,
          recipients: recipients.length,
        }),
      );
    }
  }

  ctx.log(JSON.stringify({ event: "reminders.run", ...summary }));
  return summary;
}
