/*
 * A parent signing up for a game's snack slot by picking their player from the team list. The
 * email comes from that list and is copied onto the claim, so the schedule never has to ask for
 * it. The primary action is the stored claim; the confirmation email is a secondary side effect
 * that may never fail it — a family whose confirmation bounced still has the slot.
 */
import {
  AppError,
  confirmationEmail,
  isPastGame,
  type Claim,
  type ClaimInput,
  type DataRepo,
  type PublicGame,
  type SendEmail,
} from "@soccer/shared";

export interface ClaimContext {
  today: string;
  now: Date;
  teamName: string;
  siteUrl: string;
  sendEmail: SendEmail;
  log: (line: string) => void;
}

export interface ClaimResult {
  game: PublicGame;
  /** Whether the confirmation email was captured or sent; false means it failed and was logged. */
  confirmation_sent: boolean;
}

export async function createClaim(
  repo: DataRepo,
  input: ClaimInput,
  ctx: ClaimContext,
): Promise<ClaimResult> {
  const [game, member] = await Promise.all([
    repo.getGame(input.game_id),
    repo.getRosterMember(input.player),
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
    email: member.email,
    created_at: ctx.now.toISOString(),
    reminded_at: null,
  };
  await repo.createClaim(claim);

  let confirmationSent = false;
  try {
    await ctx.sendEmail({
      to: claim.email,
      ...confirmationEmail(game, claim, ctx.teamName, ctx.siteUrl),
    });
    confirmationSent = true;
  } catch (error) {
    // Secondary side effect: log and continue. The claim stands.
    ctx.log(
      JSON.stringify({
        event: "claim.confirmation_failed",
        game_id: game.id,
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
      location: game.location,
      snack_by: claim.player,
    },
    confirmation_sent: confirmationSent,
  };
}
