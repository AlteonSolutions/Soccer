/*
 * A parent signing up for a game's snack slot. The primary action is the stored claim; the
 * confirmation email is a secondary side effect that may never fail it — a parent whose
 * confirmation bounced still has the slot, and the schedule still shows their name.
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
  const game = await repo.getGame(input.game_id);
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

  const claim: Claim = { ...input, created_at: ctx.now.toISOString(), reminded_at: null };
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

  return { game: { ...game, snack_by: claim.parent_name }, confirmation_sent: confirmationSent };
}
