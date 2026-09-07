/*
 * The public schedule. One function, so the "no email leaves this endpoint" guarantee has one
 * place to be true and one test to prove it.
 */
import { toPublicSchedule, type DataRepo, type ScheduleResponse } from "@soccer/shared";

export async function getSchedule(repo: DataRepo, teamName: string): Promise<ScheduleResponse> {
  const [games, claims] = await Promise.all([repo.listGames(), repo.listClaims()]);
  return { team_name: teamName, games: toPublicSchedule(games, claims) };
}
