/*
 * The site settings as one resolved value. The stored row may be missing (a fresh site) or come
 * from before a field existed, so every reader goes through `resolveSettings`, which fills the
 * gaps: the team name from TEAM_NAME (the pre-settings way of naming the team, kept as the
 * fallback), no allergy note, the default email templates, no uploaded badge.
 */
import type { DataRepo } from "./data.js";
import { settingsSchema, type AssetKind, type Settings } from "./schemas.js";
import { DEFAULT_TEMPLATES } from "./templates.js";

export function defaultSettings(teamName: string): Settings {
  return {
    team_name: teamName,
    coach_email: "",
    allergies: "",
    templates: DEFAULT_TEMPLATES,
    logo_updated_at: null,
    wordmark_updated_at: null,
  };
}

/** Merge a stored row (possibly partial or absent) over the defaults; a corrupt row is ignored. */
export function resolveSettings(stored: unknown, teamName: string): Settings {
  const base = defaultSettings(teamName);
  if (!stored || typeof stored !== "object") return base;
  const row = stored as Record<string, unknown>;
  // Each template is merged field by field over its default: a template saved before To and
  // BCC existed keeps its subject and body and gains the default addressing.
  const storedTemplates = (row["templates"] ?? {}) as Record<string, object | undefined>;
  const templates = Object.fromEntries(
    Object.entries(DEFAULT_TEMPLATES).map(([kind, def]) => [
      kind,
      { ...def, ...storedTemplates[kind] },
    ]),
  );
  const merged = { ...base, ...row, templates };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : base;
}

export async function loadSettings(repo: DataRepo, teamName: string): Promise<Settings> {
  return resolveSettings(await repo.getSettings(), teamName);
}

/** The URL the pages should use for an uploaded image: versioned so a new upload is never cached. */
export function assetUrlFor(settings: Settings, kind: AssetKind): string | null {
  const version = kind === "logo" ? settings.logo_updated_at : settings.wordmark_updated_at;
  return version ? `/api/assets/${kind}?v=${encodeURIComponent(version)}` : null;
}

/** The badge and logo URLs an email can fetch: absolute, on the site, versioned like the page's. */
export function emailBranding(
  settings: Settings,
  teamName: string,
  siteUrl: string,
): { teamName: string; siteUrl: string; badgeUrl: string; wordmarkUrl: string | null } {
  const base = siteUrl.replace(/\/$/, "");
  const badge = assetUrlFor(settings, "logo") ?? "/logo.svg";
  const wordmark = assetUrlFor(settings, "wordmark");
  return {
    teamName,
    siteUrl,
    badgeUrl: `${base}${badge}`,
    wordmarkUrl: wordmark ? `${base}${wordmark}` : null,
  };
}
