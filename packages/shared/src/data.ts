/*
 * The single guarded entry point for data access. Both audited projects with this rule had it
 * undocumented, and both listed "someone grabbed the raw client" as the top fresh-start hazard.
 *
 * `withData(fn)` hands `fn` a `DataRepo` and nothing else. The Azure `TableClient` instances are
 * module-private: not exported, not reachable from tests or scripts. Anything the app needs from
 * storage is a method on `DataRepo`, added here, where the table layout is visible.
 *
 * Layout — three tables in one storage account:
 *   games   partitionKey "game"   rowKey <game id>        columns = Game fields
 *   claims  partitionKey "claim"  rowKey <game id>        columns = Claim fields
 *   roster  partitionKey "member" rowKey <email, keyed>   columns = RosterMember fields
 * One claim per game is enforced by the row key: a second createEntity on the same key is a 409.
 * One roster row per email the same way; adding an existing email is an upsert, not an error.
 */
import { RestError, TableClient } from "@azure/data-tables";
import { loadConfig } from "./config.js";
import { AppError } from "./errors.js";
import {
  claimSchema,
  gameSchema,
  rosterMemberSchema,
  type Claim,
  type Game,
  type RosterMember,
} from "./schemas.js";

export interface DataRepo {
  listGames(): Promise<Game[]>;
  getGame(id: string): Promise<Game | undefined>;
  putGame(game: Game): Promise<void>;
  deleteGame(id: string): Promise<void>;
  listClaims(): Promise<Claim[]>;
  getClaim(gameId: string): Promise<Claim | undefined>;
  /** Throws AppError ALREADY_CLAIMED when the game already has one. */
  createClaim(claim: Claim): Promise<void>;
  deleteClaim(gameId: string): Promise<void>;
  markReminded(gameId: string, at: string): Promise<void>;
  markTeamReminded(gameId: string, at: string): Promise<void>;
  listRoster(): Promise<RosterMember[]>;
  /** Idempotent: an email already on the roster keeps its original added_at. */
  addRosterMembers(members: RosterMember[]): Promise<void>;
  removeRosterMember(email: string): Promise<void>;
}

const GAME_PK = "game";
const CLAIM_PK = "claim";
const ROSTER_PK = "member";

/** Table row keys may not contain / \ # ? — all legal in an email's local part, so map them. */
function rosterKey(email: string): string {
  return email.replace(/[/\\#?]/g, "_");
}

let clients: { games: TableClient; claims: TableClient; roster: TableClient } | undefined;

async function ensureTable(client: TableClient): Promise<void> {
  try {
    await client.createTable();
  } catch (error) {
    // 409 TableAlreadyExists is the steady state; anything else is a real outage.
    if (!(error instanceof RestError && error.statusCode === 409)) throw error;
  }
}

async function getClients() {
  if (clients) return clients;
  const { STORAGE_CONNECTION_STRING } = loadConfig();
  const created = {
    games: TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, "games", {
      allowInsecureConnection: true, // Azurite is plain http on localhost; production is https.
    }),
    claims: TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, "claims", {
      allowInsecureConnection: true,
    }),
    roster: TableClient.fromConnectionString(STORAGE_CONNECTION_STRING, "roster", {
      allowInsecureConnection: true,
    }),
  };
  await ensureTable(created.games);
  await ensureTable(created.claims);
  await ensureTable(created.roster);
  clients = created;
  return clients;
}

function pickColumns(
  entity: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  // Table Storage returns its own bookkeeping alongside our columns (partitionKey, rowKey, etag,
  // timestamp, and "odata.metadata" on point reads); the schemas are `.strict()` and reject them.
  const out: Record<string, unknown> = {};
  for (const key of keys) if (key in entity) out[key] = entity[key];
  return out;
}

const GAME_COLUMNS = Object.keys(gameSchema.shape);
const CLAIM_COLUMNS = Object.keys(claimSchema.shape);
const ROSTER_COLUMNS = Object.keys(rosterMemberSchema.shape);

function toGame(entity: Record<string, unknown>): Game {
  return gameSchema.parse(pickColumns(entity, GAME_COLUMNS));
}

function toClaim(entity: Record<string, unknown>): Claim {
  return claimSchema.parse(pickColumns(entity, CLAIM_COLUMNS));
}

function toRosterMember(entity: Record<string, unknown>): RosterMember {
  return rosterMemberSchema.parse(pickColumns(entity, ROSTER_COLUMNS));
}

function isNotFound(error: unknown): boolean {
  return error instanceof RestError && error.statusCode === 404;
}

function unavailable(error: unknown): AppError {
  return new AppError(
    "DATA_UNAVAILABLE",
    "The schedule is temporarily unavailable. Please try again in a minute.",
    "Table Storage call failed. Check STORAGE_CONNECTION_STRING and that Azurite/the storage account is reachable.",
    { cause: error },
  );
}

const tableRepo: DataRepo = {
  async listGames() {
    const { games } = await getClients();
    const out: Game[] = [];
    for await (const entity of games.listEntities()) out.push(toGame(entity));
    return out;
  },
  async getGame(id) {
    const { games } = await getClients();
    try {
      return toGame(await games.getEntity(GAME_PK, id));
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  },
  async putGame(game) {
    const { games } = await getClients();
    await games.upsertEntity({ partitionKey: GAME_PK, rowKey: game.id, ...game }, "Replace");
  },
  async deleteGame(id) {
    const { games } = await getClients();
    try {
      await games.deleteEntity(GAME_PK, id);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  },
  async listClaims() {
    const { claims } = await getClients();
    const out: Claim[] = [];
    for await (const entity of claims.listEntities()) out.push(toClaim(entity));
    return out;
  },
  async getClaim(gameId) {
    const { claims } = await getClients();
    try {
      return toClaim(await claims.getEntity(CLAIM_PK, gameId));
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  },
  async createClaim(claim) {
    const { claims } = await getClients();
    try {
      await claims.createEntity({ partitionKey: CLAIM_PK, rowKey: claim.game_id, ...claim });
    } catch (error) {
      if (error instanceof RestError && error.statusCode === 409) {
        throw new AppError(
          "ALREADY_CLAIMED",
          "Someone else just signed up for this game.",
          "Two parents raced for one slot; the first write won. No action needed.",
          { cause: error },
        );
      }
      throw error;
    }
  },
  async deleteClaim(gameId) {
    const { claims } = await getClients();
    try {
      await claims.deleteEntity(CLAIM_PK, gameId);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  },
  async markReminded(gameId, at) {
    const { claims } = await getClients();
    await claims.updateEntity({ partitionKey: CLAIM_PK, rowKey: gameId, reminded_at: at }, "Merge");
  },
  async markTeamReminded(gameId, at) {
    const { games } = await getClients();
    await games.updateEntity(
      { partitionKey: GAME_PK, rowKey: gameId, team_reminded_at: at },
      "Merge",
    );
  },
  async listRoster() {
    const { roster } = await getClients();
    const out: RosterMember[] = [];
    for await (const entity of roster.listEntities()) out.push(toRosterMember(entity));
    return out;
  },
  async addRosterMembers(members) {
    const { roster } = await getClients();
    for (const member of members) {
      try {
        await roster.createEntity({
          partitionKey: ROSTER_PK,
          rowKey: rosterKey(member.email),
          ...member,
        });
      } catch (error) {
        // Already on the list: keep the original row (and its added_at).
        if (!(error instanceof RestError && error.statusCode === 409)) throw error;
      }
    }
  },
  async removeRosterMember(email) {
    const { roster } = await getClients();
    try {
      await roster.deleteEntity(ROSTER_PK, rosterKey(email));
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  },
};

/**
 * Run `fn` against the data store. Storage failures that are not part of the domain (network,
 * auth, emulator down) surface as one `DATA_UNAVAILABLE` AppError with the raw error as `cause`.
 */
export async function withData<T>(fn: (repo: DataRepo) => Promise<T>): Promise<T> {
  try {
    return await fn(tableRepo);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw unavailable(error);
  }
}
