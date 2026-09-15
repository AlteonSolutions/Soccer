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
  formatDate,
  isPastGame,
  loadSettings,
  RECIPIENT_LEGEND,
  reminderEmail,
  selectUnclaimed,
  sortByDate,
  teamReminderEmail,
  TEMPLATE_PLACEHOLDERS,
  unclaimedNudgeEmail,
  type Claim,
  type DataRepo,
  type EmailKind,
  type EmailMessage,
  type EmailPreviewInput,
  type EmailTemplates,
  type Game,
  type LogoAsset,
  type SendEmail,
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
  recipients: Record<string, string>;
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
  recipients: RECIPIENT_LEGEND[kind],
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

export interface EmailPreview extends EmailMessage {
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
  fallbackCoachEmail: string | undefined,
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
    coachEmail: settings.coach_email || fallbackCoachEmail,
    allergies: settings.allergies,
    templates: { ...settings.templates, [input.kind]: input.template },
  };
  let message: EmailMessage;
  switch (input.kind) {
    case "claim_confirmation":
      message = confirmationEmail(game, claim, site, roster);
      break;
    case "snack_reminder":
      message = reminderEmail(game, claim, site, roster);
      break;
    case "team_reminder":
      message = teamReminderEmail(game, existing, site, roster);
      break;
    case "coach_nudge": {
      const unclaimed = selectUnclaimed(games, claims, today);
      message = unclaimedNudgeEmail(unclaimed.length > 0 ? unclaimed : [game], site, roster);
      break;
    }
  }
  return {
    ...message,
    based_on: { game: `${formatDate(game.date)} vs ${game.opponent}`, player },
  };
}

export interface TestSendResult {
  to: string;
  subject: string;
}

/**
 * Send one template, as typed, to the coach only: the preview's exact subject and body, with the
 * To and BCC lines ignored so no parent can be emailed by a test. Nothing is marked reminded.
 * Exists because the daily run only sends on a real Monday or Thursday, so there was no way to
 * see a reminder in an inbox without waiting for one.
 */
export async function sendTestEmail(
  repo: DataRepo,
  input: EmailPreviewInput,
  siteUrl: string,
  teamName: string,
  fallbackCoachEmail: string | undefined,
  today: string,
  sendEmail: SendEmail,
): Promise<TestSendResult> {
  const settings = await loadSettings(repo, teamName);
  const to = settings.coach_email || fallbackCoachEmail;
  if (!to) {
    throw new AppError(
      "VALIDATION",
      "Enter your Coach Email in Site Settings and save it first; the test goes there.",
      "Test send with no coach email in settings or COACH_EMAIL.",
    );
  }
  const preview = await previewEmail(repo, input, siteUrl, teamName, fallbackCoachEmail, today);
  await sendEmail({ to: [to], bcc: [], subject: preview.subject, text: preview.text });
  return { to, subject: preview.subject };
}
