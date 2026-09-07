/*
 * Every shape that crosses a boundary — HTTP body, table row, email — is declared here once as a
 * zod schema, and the TypeScript type is inferred from it. Pure: imports only zod, so the browser
 * client can `import type` from "@soccer/shared/schemas" without dragging in Node-only modules.
 *
 * The rule that matters most: a parent's email address is in `claimSchema` and nowhere in
 * `publicGameSchema`. The public API is typed so that it cannot carry one.
 */
import { z } from "zod";

// 1–60 characters: long enough for "Grandma & Grandpa Hernandez", short enough to fit a table cell.
const parentName = z.string().trim().min(1).max(60);

// YYYY-MM-DD-<slug>: sortable by date, readable in a URL.
export const gameIdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const gameSchema = z
  .object({
    id: gameIdSchema,
    date: z.iso.date(),
    kickoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM (24-hour)"),
    opponent: z.string().trim().min(1).max(80),
    location: z.string().trim().min(1).max(120),
    // Table Storage cannot store null: a game not yet announced has no column, so absent = null.
    team_reminded_at: z.iso.datetime().nullable().default(null),
  })
  .strict();
export type Game = z.infer<typeof gameSchema>;

/** What the coach submits to add a game; the id is derived from date and opponent. */
export const newGameInputSchema = gameSchema.omit({ id: true, team_reminded_at: true });
export type NewGameInput = z.infer<typeof newGameInputSchema>;

/** What a parent submits to claim a game's snack slot. */
export const claimInputSchema = z
  .object({
    game_id: gameIdSchema,
    parent_name: parentName,
    // 254 is the RFC 5321 maximum for an address.
    email: z.email().trim().toLowerCase().max(254),
  })
  .strict();
export type ClaimInput = z.infer<typeof claimInputSchema>;

/** A stored claim. `email` lives here and in the admin API only. */
export const claimSchema = claimInputSchema
  .extend({
    created_at: z.iso.datetime(),
    // Table Storage cannot store null: an un-reminded claim has no column at all, so absent = null.
    reminded_at: z.iso.datetime().nullable().default(null),
  })
  .strict();
export type Claim = z.infer<typeof claimSchema>;

/** A game as the public site sees it: who is bringing snacks, by name, never by email. */
export const publicGameSchema = gameSchema
  .omit({ team_reminded_at: true })
  .extend({ snack_by: parentName.nullable() })
  .strict();
export type PublicGame = z.infer<typeof publicGameSchema>;

export const scheduleResponseSchema = z
  .object({ team_name: z.string(), games: z.array(publicGameSchema) })
  .strict();
export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;

/** The coach's view: games joined with full claims, emails included. */
export const adminGameSchema = gameSchema.extend({ claim: claimSchema.nullable() }).strict();
export type AdminGame = z.infer<typeof adminGameSchema>;

/** A family on the team's email list. Coach-managed; never shown outside the admin page. */
export const rosterMemberSchema = z
  .object({
    email: z.email().trim().toLowerCase().max(254),
    added_at: z.iso.datetime(),
  })
  .strict();
export type RosterMember = z.infer<typeof rosterMemberSchema>;

/** Bulk add: the coach pastes the team list. 100 is far above any youth team's family count. */
export const rosterInputSchema = z
  .object({ emails: z.array(z.email().trim().toLowerCase().max(254)).min(1).max(100) })
  .strict();
export type RosterInput = z.infer<typeof rosterInputSchema>;

/** Every error the API returns has this shape; the client renders `message`, logs `code`. */
export const apiErrorSchema = z
  .object({ error: z.object({ code: z.string(), message: z.string() }).strict() })
  .strict();
export type ApiError = z.infer<typeof apiErrorSchema>;
