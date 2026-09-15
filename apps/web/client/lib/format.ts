/*
 * Presentation helpers for the client, kept free of the DOM so they are tested directly. Dates
 * and kickoffs are formatted by @soccer/shared/format so the page and the emails agree.
 */
import { allergyList, joinWithAnd } from "@soccer/shared/format";
import type { PublicGame } from "@soccer/shared/schemas";

/** "Snack Duty: Leo Rivera" – a label, not a sentence, so plural family names never read wrong. */
export function describeSnack(game: Pick<PublicGame, "snack_by">): string {
  return game.snack_by ? `Snack Duty: ${game.snack_by}` : "Snack Duty: nobody yet";
}

/**
 * The team line above the games: "We have 14 players and peanut and tree nut food allergies."
 * `allergies` is the coach's comma-separated list; empty means none.
 */
export function describeTeam(playerCount: number, allergies: string): string {
  const list = allergyList(allergies);
  const players = `${playerCount} player${playerCount === 1 ? "" : "s"}`;
  if (list.length === 0) return `We have ${players} and no food allergies.`;
  if (list.length === 1) return `We have ${players} and a ${list[0]} food allergy.`;
  return `We have ${players} and ${joinWithAnd(list)} food allergies.`;
}
