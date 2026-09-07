/*
 * The public schedule. One function, so the "no email leaves this endpoint" guarantee has one
 * place to be true and one test to prove it.
 */
import {
  toPlayerNames,
  toPublicSchedule,
  type DataRepo,
  type ScheduleResponse,
} from "@soccer/shared";

export async function getSchedule(repo: DataRepo, teamName: string): Promise<ScheduleResponse> {
  const [games, claims, roster] = await Promise.all([
    repo.listGames(),
    repo.listClaims(),
    repo.listRoster(),
  ]);
  return {
    team_name: teamName,
    games: toPublicSchedule(games, claims),
    players: toPlayerNames(roster),
  };
}
