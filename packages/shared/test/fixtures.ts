import type { Claim, Game, RosterMember } from "../src/schemas.js";

export function game(overrides: Partial<Game> = {}): Game {
  return {
    id: "2026-09-19-red-dragons",
    date: "2026-09-19",
    kickoff: "10:00",
    opponent: "Red Dragons",
    location: "Field 3, Riverside Park",
    team_reminded_at: null,
    ...overrides,
  };
}

export function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    game_id: "2026-09-19-red-dragons",
    player: "Leo Rivera",
    created_at: "2026-09-10T12:00:00.000Z",
    reminded_at: null,
    ...overrides,
  };
}

export function member(overrides: Partial<RosterMember> = {}): RosterMember {
  return {
    player: "Leo Rivera",
    emails: ["sam@example.com"],
    added_at: "2026-08-20T00:00:00.000Z",
    ...overrides,
  };
}
