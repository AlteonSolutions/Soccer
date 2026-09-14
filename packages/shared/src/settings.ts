/*
 * The site settings as one resolved value. The stored row may be missing (a fresh site) or come
 * from before a field existed, so every reader goes through `resolveSettings`, which fills the
 * gaps: the team name from TEAM_NAME (the pre-settings way of naming the team, kept as the
 * fallback), no allergy note, the default email templates, no uploaded badge.
 */
import type { DataRepo } from "./data.js";
import { settingsSchema, type Settings } from "./schemas.js";
import { DEFAULT_TEMPLATES } from "./templates.js";

export function defaultSettings(teamName: string): Settings {
  return {
    team_name: teamName,
    allergies: "",
    templates: DEFAULT_TEMPLATES,
    logo_updated_at: null,
  };
}

/** Merge a stored row (possibly partial or absent) over the defaults; a corrupt row is ignored. */
export function resolveSettings(stored: unknown, teamName: string): Settings {
  const base = defaultSettings(teamName);
  if (!stored || typeof stored !== "object") return base;
  const row = stored as Record<string, unknown>;
  const merged = {
    ...base,
    ...row,
    templates: { ...DEFAULT_TEMPLATES, ...(row["templates"] as object | undefined) },
  };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : base;
}

export async function loadSettings(repo: DataRepo, teamName: string): Promise<Settings> {
  return resolveSettings(await repo.getSettings(), teamName);
}

/** The badge URL the pages should use: versioned so a new upload is never served from cache. */
export function logoUrlFor(settings: Pick<Settings, "logo_updated_at">): string | null {
  return settings.logo_updated_at
    ? `/api/logo?v=${encodeURIComponent(settings.logo_updated_at)}`
    : null;
}
