/*
 * The coach's site settings and the uploaded badge. Settings are one row; the badge is one blob.
 * Reading always resolves defaults (see @soccer/shared settings.ts), so a fresh site and a site
 * from before a field existed both behave. Uploading a badge stamps `logo_updated_at` on the
 * settings row, which is what versions the public URL so browsers never show a stale badge.
 */
import {
  AppError,
  DEFAULT_TEMPLATES,
  EMAIL_KINDS,
  EMAIL_TITLES,
  loadSettings,
  TEMPLATE_PLACEHOLDERS,
  type DataRepo,
  type EmailKind,
  type EmailTemplates,
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
