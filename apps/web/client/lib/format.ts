/*
 * Presentation helpers for the client, kept free of the DOM so they are tested directly. The
 * quiet failure here is a date shown one day off: a YYYY-MM-DD string passed to `new Date()` is
 * parsed as UTC midnight and renders as the previous evening in US time zones.
 */
import type { PublicGame } from "@soccer/shared/schemas";

/** "Sat, Sep 19" from "2026-09-19", without a time-zone shift. */
export function formatDate(dateIso: string): string {
  const [y, m, d] = dateIso.split("-").map(Number) as [number, number, number];
  // Construct as local midnight so the calendar date is preserved.
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** The pieces of a calendar tile: "SEP", "19", "Sat" — from "2026-09-19", no time-zone shift. */
export function dateParts(dateIso: string): { month: string; day: string; weekday: string } {
  const [y, m, d] = dateIso.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return {
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d),
    weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
  };
}

/** "10:00 AM" from "10:00". */
export function formatKickoff(kickoff: string): string {
  const [h, min] = kickoff.split(":").map(Number) as [number, number];
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(min).padStart(2, "0")} ${suffix}`;
}

/** "Snacks: The Nguyens" — a label, not a sentence, so plural family names never read wrong. */
export function describeSnack(game: Pick<PublicGame, "snack_by">): string {
  return game.snack_by ? `Snacks: ${game.snack_by}` : "Snacks: nobody yet";
}
