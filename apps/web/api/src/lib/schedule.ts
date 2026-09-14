/*
 * The public schedule. One function, so the "no email leaves this endpoint" guarantee has one
 * place to be true and one test to prove it. The team name, the allergy note and the badge come
 * from the coach's settings so an edit on the admin page shows on the next page load.
 */
import {
  loadSettings,
  logoUrlFor,
  toPlayerNames,
  toPublicSchedule,
  type DataRepo,
  type ScheduleResponse,
} from "@soccer/shared";

export async function getSchedule(repo: DataRepo, teamName: string): Promise<ScheduleResponse> {
  const [games, claims, roster, settings] = await Promise.all([
    repo.listGames(),
    repo.listClaims(),
    repo.listRoster(),
    loadSettings(repo, teamName),
  ]);
  return {
    team_name: settings.team_name,
    allergies: settings.allergies,
    logo_url: logoUrlFor(settings),
    games: toPublicSchedule(games, claims),
    players: toPlayerNames(roster),
  };
}
