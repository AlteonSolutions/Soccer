/*
 * A parent signing up for a game's snack slot by picking their player from the team list. The
 * claim records the player only; the parent emails are read from the team list whenever an email
 * is sent (here, and by the Monday timer), so a corrected address is used everywhere at once. The primary action is the stored claim; the
 * confirmation email is a secondary side effect that may never fail it – a family whose
 * confirmation bounced still has the slot.
 */
import {
  AppError,
  confirmationEmail,
  isPastGame,
  recipientCount,
  type Claim,
  type ClaimInput,
  type DataRepo,
  type EmailTemplates,
  type PublicGame,
  type SendEmail,
} from "@soccer/shared";

export interface ClaimContext {
  today: string;
  now: Date;
  teamName: string;
  siteUrl: string;
  /** Where {{coach}} goes: the settings' coach email, else COACH_EMAIL, else nobody. */
  coachEmail: string | undefined;
  /** Absolute badge and logo URLs for the HTML email, from emailBranding(). */
  badgeUrl: string;
  wordmarkUrl: string | null;
  /** The coach's allergy list, for the emails that mention it. */
  allergies: string;
  /** The coach's email copy, from the site settings. */
  templates: EmailTemplates;
  sendEmail: SendEmail;
  log: (line: string) => void;
}

export interface ClaimResult {
  game: PublicGame;
  /** Whether at least one confirmation was captured or sent; false means all failed and were logged. */
  confirmation_sent: boolean;
}

export async function createClaim(
  repo: DataRepo,
  input: ClaimInput,
  ctx: ClaimContext,
): Promise<ClaimResult> {
  const [game, member, roster] = await Promise.all([
    repo.getGame(input.game_id),
    repo.getRosterMember(input.player),
    repo.listRoster(),
  ]);
  if (!member) {
    throw new AppError(
      "VALIDATION",
      "Pick a player from the team list.",
      "Claim named a player not on the roster; the client should only offer roster names.",
    );
  }
  if (!game) {
    throw new AppError(
      "NOT_FOUND",
      "That game is no longer on the schedule.",
      "Claim for unknown game id; the coach may have deleted it.",
    );
  }
  if (isPastGame(game, ctx.today)) {
    throw new AppError(
      "GAME_IN_PAST",
      "That game has already been played.",
      "Claim for a past game; the client should not offer the button.",
    );
  }

  const claim: Claim = {
    game_id: game.id,
    player: member.player,
    created_at: ctx.now.toISOString(),
    reminded_at: null,
  };
  await repo.createClaim(claim);

  // The template's To/BCC lines say who gets the confirmation (by default the parents on the team
  // list for this player). Nobody to send to is logged like a failed send; the claim stands.
  let confirmationSent = false;
  const message = confirmationEmail(game, claim, ctx, roster);
  try {
    if (recipientCount(message) === 0) throw new Error("no recipients");
    await ctx.sendEmail(message);
    confirmationSent = true;
  } catch (error) {
    // Secondary side effect: log and continue. The claim stands.
    ctx.log(
      JSON.stringify({
        event: "claim.confirmation_failed",
        game_id: game.id,
        recipients: recipientCount(message),
        detail: String(error),
      }),
    );
  }

  return {
    game: {
      id: game.id,
      date: game.date,
      kickoff: game.kickoff,
      opponent: game.opponent,
      snack_by: claim.player,
    },
    confirmation_sent: confirmationSent,
  };
}
