/*
 * The coach's site settings and the uploaded badge. Settings are one row; the badge is one blob.
 * Reading always resolves defaults (see @soccer/shared settings.ts), so a fresh site and a site
 * from before a field existed both behave. Uploading a badge stamps `logo_updated_at` on the
 * settings row, which is what versions the public URL so browsers never show a stale badge.
 */
import {
  AppError,
  confirmationEmail,
  DEFAULT_TEMPLATES,
  EMAIL_KINDS,
  EMAIL_TITLES,
  isPastGame,
  loadSettings,
  reminderEmail,
  selectUnclaimed,
  sortByDate,
  teamReminderEmail,
  TEMPLATE_PLACEHOLDERS,
  unclaimedNudgeEmail,
  type Claim,
  type DataRepo,
  type EmailCopy,
  type EmailKind,
  type EmailPreviewInput,
  type EmailTemplates,
  type Game,
  type LogoAsset,
  type Settings,
  type SettingsInput,
} from "@soccer/shared";

// 2 MB: the badge renders at 84 px; a photo-sized file is a mistake, and the API answers every
// page load for it.
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const IMAGE_TYPE = /^image\/[a-z0-9.+-]+$/i;

export interface EmailKindInfo {
  kind: EmailKind;
  title: string;
  placeholders: Record<string, string>;
}

export interface SettingsResponse {
  settings: Settings;
  /** What "Reset" restores on the admin page; sent so the page never redeclares the copy. */
  default_templates: EmailTemplates;
  /** The emails in display order with their placeholder legends, for the same reason. */
  emails: EmailKindInfo[];
}

const EMAILS: EmailKindInfo[] = EMAIL_KINDS.map((kind) => ({
  kind,
  title: EMAIL_TITLES[kind],
  placeholders: TEMPLATE_PLACEHOLDERS[kind],
}));

function respond(settings: Settings): SettingsResponse {
  return { settings, default_templates: DEFAULT_TEMPLATES, emails: EMAILS };
}

export async function getSettings(repo: DataRepo, teamName: string): Promise<SettingsResponse> {
  return respond(await loadSettings(repo, teamName));
}

export async function updateSettings(
  repo: DataRepo,
  teamName: string,
  input: SettingsInput,
): Promise<SettingsResponse> {
  const current = await loadSettings(repo, teamName);
  const next: Settings = { ...current, ...input };
  await repo.putSettings(next);
  return respond(next);
}

export async function putLogo(
  repo: DataRepo,
  teamName: string,
  contentType: string | null,
  bytes: Uint8Array,
  now: Date,
): Promise<Settings> {
  const type = (contentType ?? "").split(";")[0]?.trim() ?? "";
  if (!IMAGE_TYPE.test(type)) {
    throw new AppError(
      "VALIDATION",
      "Choose an image file (PNG, JPG, SVG, WebP or GIF).",
      `Logo upload with content type "${type}"; the browser sets it from the file.`,
    );
  }
  if (bytes.byteLength === 0) {
    throw new AppError("VALIDATION", "Choose an image file first.", "Empty body on logo upload.");
  }
  if (bytes.byteLength > MAX_LOGO_BYTES) {
    throw new AppError(
      "VALIDATION",
      "That image is too large. Anything under 2 MB is plenty for a badge.",
      "Logo upload over MAX_LOGO_BYTES.",
    );
  }
  const updated_at = now.toISOString();
  await repo.putLogo({ content_type: type, bytes, updated_at });
  const current = await loadSettings(repo, teamName);
  const next: Settings = { ...current, logo_updated_at: updated_at };
  await repo.putSettings(next);
  return next;
}

export async function removeLogo(repo: DataRepo, teamName: string): Promise<Settings> {
  await repo.deleteLogo();
  const current = await loadSettings(repo, teamName);
  const next: Settings = { ...current, logo_updated_at: null };
  await repo.putSettings(next);
  return next;
}

export async function getLogo(repo: DataRepo): Promise<LogoAsset | undefined> {
  return repo.getLogo();
}

// A stand-in for a site with no games yet, so the preview always has something to fill in.
const SAMPLE_GAME: Game = {
  id: "2026-09-19-red-dragons",
  date: "2026-09-19",
  kickoff: "10:00",
  opponent: "Red Dragons",
  team_reminded_at: null,
};

export interface EmailPreview extends EmailCopy {
  /** What the placeholders were filled from, so the page can say "using the game on …". */
  based_on: { game: string; player: string };
}

/**
 * Render one template, as typed on the admin page and not yet saved, through the same builders
 * that send the real emails. Values come from the next game on the schedule and the family signed
 * up for it (or the first player on the team list), so the coach sees a real email, not lorem ipsum.
 */
export async function previewEmail(
  repo: DataRepo,
  input: EmailPreviewInput,
  siteUrl: string,
  teamName: string,
  today: string,
): Promise<EmailPreview> {
  const [games, claims, roster, settings] = await Promise.all([
    repo.listGames(),
    repo.listClaims(),
    repo.listRoster(),
    loadSettings(repo, teamName),
  ]);
  const game = sortByDate(games.filter((g) => !isPastGame(g, today)))[0] ?? SAMPLE_GAME;
  const existing = claims.find((c) => c.game_id === game.id);
  const player = existing?.player ?? roster[0]?.player ?? "Leo Rivera";
  const claim: Claim = existing ?? {
    game_id: game.id,
    player,
    created_at: `${today}T00:00:00.000Z`,
    reminded_at: null,
  };
  const site = {
    teamName: input.team_name,
    siteUrl,
    templates: { ...settings.templates, [input.kind]: input.template },
  };
  let copy: EmailCopy;
  switch (input.kind) {
    case "claim_confirmation":
      copy = confirmationEmail(game, claim, site);
      break;
    case "snack_reminder":
      copy = reminderEmail(game, claim, site);
      break;
    case "team_reminder":
      copy = teamReminderEmail(game, existing, site);
      break;
    case "coach_nudge": {
      const unclaimed = selectUnclaimed(games, claims, today);
      copy = unclaimedNudgeEmail(unclaimed.length > 0 ? unclaimed : [game], site);
      break;
    }
  }
  return { ...copy, based_on: { game: `${game.date} vs ${game.opponent}`, player } };
}
