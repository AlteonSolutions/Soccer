/*
 * The daily reminder run as a pure-ish function of (repo, sendEmail, clock, config). Called by
 * the timer trigger in index.ts and directly by tests. Two rules it exists to enforce:
 *   - a claim is reminded at most once (`reminded_at` is written before the next run);
 *   - one failed email never stops the rest of the run.
 */
import {
  reminderEmail,
  selectRemindersDue,
  selectUnclaimed,
  unclaimedNudgeEmail,
  type DataRepo,
  type SendEmail,
} from "@soccer/shared";

export interface RunContext {
  today: string;
  now: Date;
  daysAhead: number;
  teamName: string;
  siteUrl: string;
  coachEmail: string | undefined;
  sendEmail: SendEmail;
  log: (line: string) => void;
}

export interface RunSummary {
  reminders_sent: number;
  reminders_failed: number;
  unclaimed_games: number;
  coach_nudged: boolean;
}

export async function runReminders(repo: DataRepo, ctx: RunContext): Promise<RunSummary> {
  const [games, claims] = await Promise.all([repo.listGames(), repo.listClaims()]);
  const summary: RunSummary = {
    reminders_sent: 0,
    reminders_failed: 0,
    unclaimed_games: 0,
    coach_nudged: false,
  };

  for (const { game, claim } of selectRemindersDue(games, claims, ctx.today, ctx.daysAhead)) {
    try {
      await ctx.sendEmail({
        to: claim.email,
        ...reminderEmail(game, claim, ctx.teamName, ctx.siteUrl),
      });
      await repo.markReminded(game.id, ctx.now.toISOString());
      summary.reminders_sent += 1;
      ctx.log(JSON.stringify({ event: "reminder.sent", game_id: game.id }));
    } catch (error) {
      summary.reminders_failed += 1;
      ctx.log(
        JSON.stringify({ event: "reminder.failed", game_id: game.id, detail: String(error) }),
      );
    }
  }

  const unclaimed = selectUnclaimed(games, claims, ctx.today, ctx.daysAhead);
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

  ctx.log(JSON.stringify({ event: "reminders.run", ...summary }));
  return summary;
}
