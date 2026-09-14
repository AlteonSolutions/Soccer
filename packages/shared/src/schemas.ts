/*
 * Every shape that crosses a boundary – HTTP body, table row, email – is declared here once as a
 * zod schema, and the TypeScript type is inferred from it. Pure: imports only zod, so the browser
 * client can `import type` from "@soccer/shared/schemas" without dragging in Node-only modules.
 *
 * The rule that matters most: a parent's email address is in `claimSchema` and nowhere in
 * `publicGameSchema`. The public API is typed so that it cannot carry one.
 */
import { z } from "zod";

// 1–60 characters: long enough for a double-barrelled name, short enough to fit a table cell.
const playerName = z.string().trim().min(1).max(60);
const emailAddress = z.email().trim().toLowerCase().max(254); // 254 is the RFC 5321 maximum
// A player's parent emails: two parents plus two more caregivers is the most any family has asked for.
const emailList = z.array(emailAddress).min(1).max(4);

// YYYY-MM-DD-<slug>: sortable by date, readable in a URL.
export const gameIdSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const gameSchema = z
  .object({
    id: gameIdSchema,
    date: z.iso.date(),
    kickoff: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM (24-hour)"),
    opponent: z.string().trim().min(1).max(80),
    // Table Storage cannot store null: a game not yet announced has no column, so absent = null.
    team_reminded_at: z.iso.datetime().nullable().default(null),
  })
  .strict();
export type Game = z.infer<typeof gameSchema>;

/** What the coach submits to add a game; the id is derived from date and opponent. */
export const newGameInputSchema = gameSchema.omit({ id: true, team_reminded_at: true });
export type NewGameInput = z.infer<typeof newGameInputSchema>;

/** A season pasted in at once: the PDF import. 60 is more than any rec season has games. */
export const bulkGamesInputSchema = z
  .object({ games: z.array(newGameInputSchema).min(1).max(60) })
  .strict();
export type BulkGamesInput = z.infer<typeof bulkGamesInputSchema>;

/** One row of the import preview: what was read, and what importing it would do. */
export const importPreviewRowSchema = newGameInputSchema
  .extend({ id: gameIdSchema, status: z.enum(["new", "unchanged", "changed"]) })
  .strict();
export type ImportPreviewRow = z.infer<typeof importPreviewRowSchema>;

export const importPreviewSchema = z
  .object({
    games: z.array(importPreviewRowSchema),
    /** Lines that looked like they might be games but could not be read. Shown to the coach. */
    skipped: z.array(z.string()),
  })
  .strict();
export type ImportPreview = z.infer<typeof importPreviewSchema>;

/** What a parent submits to claim a game's snack slot: which player, chosen from the team list. */
export const claimInputSchema = z
  .object({
    game_id: gameIdSchema,
    player: playerName,
  })
  .strict();
export type ClaimInput = z.infer<typeof claimInputSchema>;

/** A stored claim: which player, when. No email lives here – addresses are looked up on the team list at send time. */
export const claimSchema = claimInputSchema
  .extend({
    created_at: z.iso.datetime(),
    // Table Storage cannot store null: an un-reminded claim has no column at all, so absent = null.
    reminded_at: z.iso.datetime().nullable().default(null),
  })
  .strict();
export type Claim = z.infer<typeof claimSchema>;

/** A game as the public site sees it: which player's family has snacks, never an email. */
export const publicGameSchema = gameSchema
  .omit({ team_reminded_at: true })
  .extend({ snack_by: playerName.nullable() })
  .strict();
export type PublicGame = z.infer<typeof publicGameSchema>;

/** The schedule plus the player names to pick from. Names only: the emails never leave the server. */
export const scheduleResponseSchema = z
  .object({
    team_name: z.string(),
    // The coach's comma-separated allergy list ("peanut, tree nut"); the page makes a sentence.
    allergies: z.string(),
    // Versioned URL of the uploaded badge, or null to use the built-in one.
    logo_url: z.string().nullable(),
    games: z.array(publicGameSchema),
    players: z.array(playerName),
  })
  .strict();
export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;

// ---- Site settings: what the coach edits on the admin page and every page and email reads.

/** One email's copy. Placeholders are `{{name}}`; see TEMPLATE_PLACEHOLDERS in templates.ts. */
export const emailTemplateSchema = z
  .object({
    subject: z.string().trim().min(1).max(200),
    text: z.string().min(1).max(4000),
  })
  .strict();
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;

export const EMAIL_KINDS = [
  "claim_confirmation",
  "snack_reminder",
  "team_reminder",
  "coach_nudge",
] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export const emailTemplatesSchema = z
  .object({
    claim_confirmation: emailTemplateSchema,
    snack_reminder: emailTemplateSchema,
    team_reminder: emailTemplateSchema,
    coach_nudge: emailTemplateSchema,
  })
  .strict();
export type EmailTemplates = z.infer<typeof emailTemplatesSchema>;

/** What the coach can edit. */
export const settingsInputSchema = z
  .object({
    team_name: z.string().trim().min(1).max(60),
    // 300 characters: a comma-separated list ("peanut, tree nut"), not a policy document.
    allergies: z.string().trim().max(300),
    templates: emailTemplatesSchema,
  })
  .strict();
export type SettingsInput = z.infer<typeof settingsInputSchema>;

/** One template as typed on the admin page, to be rendered with real values before saving. */
export const emailPreviewInputSchema = z
  .object({
    team_name: z.string().trim().min(1).max(60),
    kind: z.enum(EMAIL_KINDS),
    template: emailTemplateSchema,
  })
  .strict();
export type EmailPreviewInput = z.infer<typeof emailPreviewInputSchema>;

/** The effective settings: the input plus the state of the uploaded badge. */
export const settingsSchema = settingsInputSchema
  .extend({
    // When the coach last uploaded a badge, or null for the built-in one. Doubles as the cache key.
    logo_updated_at: z.string().nullable(),
  })
  .strict();
export type Settings = z.infer<typeof settingsSchema>;

/** An uploaded badge as stored: the bytes and the type the browser must be told. */
export interface LogoAsset {
  content_type: string;
  bytes: Uint8Array;
  updated_at: string;
}

/** The coach's view: games joined with their claim and the current parent emails for that player. */
export const adminGameSchema = gameSchema
  .extend({ claim: claimSchema.nullable(), emails: z.array(emailAddress) })
  .strict();
export type AdminGame = z.infer<typeof adminGameSchema>;

/** A player on the team and the parent emails behind them. Coach-managed; the email is never shown outside the admin page. */
export const rosterMemberSchema = z
  .object({
    player: playerName,
    emails: emailList,
    added_at: z.iso.datetime(),
    // Where the player sits in the league\'s roster; the list is shown in this order. Absent = 0 (older rows).
    position: z.number().int().nonnegative().default(0),
  })
  .strict();
export type RosterMember = z.infer<typeof rosterMemberSchema>;

/** Bulk add or correct: the coach pastes "Player Name, parent@example.com, other@example.com" lines. 100 is far above any youth team. */
export const rosterInputSchema = z
  .object({
    members: z
      .array(
        z
          .object({
            player: playerName,
            emails: emailList,
            position: z.number().int().nonnegative().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export type RosterInput = z.infer<typeof rosterInputSchema>;

/** Editing one player on the team list: the name (a rename moves their sign-ups) and the emails. */
export const rosterMemberUpdateSchema = z
  .object({ player: playerName, emails: emailList })
  .strict();
export type RosterMemberUpdate = z.infer<typeof rosterMemberUpdateSchema>;

/** One row of the roster import preview. */
export const rosterPreviewRowSchema = z
  .object({
    player: playerName,
    emails: emailList,
    status: z.enum(["new", "unchanged", "changed"]),
  })
  .strict();
export type RosterPreviewRow = z.infer<typeof rosterPreviewRowSchema>;

export const rosterImportPreviewSchema = z
  .object({
    members: z.array(rosterPreviewRowSchema),
    no_email: z.array(playerName),
    truncated: z.array(playerName),
  })
  .strict();
export type RosterImportPreview = z.infer<typeof rosterImportPreviewSchema>;

/** Every error the API returns has this shape; the client renders `message`, logs `code`. */
export const apiErrorSchema = z
  .object({ error: z.object({ code: z.string(), message: z.string() }).strict() })
  .strict();
export type ApiError = z.infer<typeof apiErrorSchema>;
