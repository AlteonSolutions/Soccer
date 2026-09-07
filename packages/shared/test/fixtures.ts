import type { Claim, Game } from "../src/schemas.js";

export function game(overrides: Partial<Game> = {}): Game {
  return {
    id: "2026-09-19-red-dragons",
    date: "2026-09-19",
    kickoff: "10:00",
    opponent: "Red Dragons",
    location: "Field 3, Riverside Park",
    notes: "",
    ...overrides,
  };
}

export function claim(overrides: Partial<Claim> = {}): Claim {
  return {
    game_id: "2026-09-19-red-dragons",
    parent_name: "Sam Rivera",
    email: "sam@example.com",
    created_at: "2026-09-10T12:00:00.000Z",
    reminded_at: null,
    ...overrides,
  };
}
