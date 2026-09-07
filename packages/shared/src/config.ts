/*
 * The only place the process environment is read.
 *
 * Why it exists: one audited project read `process.env` in 36 places and could enumerate its own
 * configuration only by grep. Here every variable is declared once, validated once, and a missing
 * or malformed value fails at startup with the variable's name and what to do about it — not
 * later, somewhere else, as `undefined`.
 *
 * What breaks without it: a typo'd variable name silently becomes a default; a bad PORT becomes
 * NaN and the server "starts" listening on nothing. ESLint forbids `process.env` outside this file.
 *
 * Adding a variable: add it to `envSchema` here and to `.env.example` in the same commit.
 */
import { z } from "zod";

// Every variable the code reads. Keep this in step with .env.example.
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // 1–65535 is the valid TCP port range; 3000 is the conventional local dev port.
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  })
  .strict();

export type Config = z.infer<typeof envSchema>;

/** A configuration failure: carries a code and the remediation text, per the house error rule. */
export class ConfigError extends Error {
  readonly code = "CONFIG_INVALID" as const;
  /** The environment variables that were missing or malformed, by name. */
  readonly variables: readonly string[];
  readonly remediation: string;

  constructor(variables: readonly string[], details: readonly string[]) {
    const remediation =
      `Set ${variables.join(", ")} in .env (see .env.example for the meaning of each).` +
      ` Details: ${details.join("; ")}`;
    super(`Invalid configuration: ${variables.join(", ")}. ${remediation}`);
    this.name = "ConfigError";
    this.variables = variables;
    this.remediation = remediation;
  }
}

type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Validate `source` against `schema`, reading only the keys the schema declares. Throws a
 * `ConfigError` naming every offending variable at once, so a fresh clone learns about all of its
 * missing settings in one run rather than one per restart.
 */
export function parseEnv<T extends z.ZodObject>(schema: T, source: EnvSource): z.infer<T> {
  // Pick only declared keys: the process environment carries PATH, HOME and hundreds more, and
  // `.strict()` must reject unknown keys in *our* set without rejecting the machine's.
  const picked: Record<string, string> = {};
  for (const key of Object.keys(schema.shape)) {
    const value = source[key];
    // An empty string is "unset": `PORT=` in a .env file means "use the default", not port "".
    if (value !== undefined && value !== "") picked[key] = value;
  }

  const result = schema.safeParse(picked);
  if (result.success) return result.data as z.infer<T>;

  const variables = [...new Set(result.error.issues.map((issue) => String(issue.path[0])))];
  const details = result.error.issues.map((issue) => `${String(issue.path[0])}: ${issue.message}`);
  throw new ConfigError(variables, details);
}

let cached: Config | undefined;

/**
 * The application configuration. Reads `process.env` on first call and caches the result; pass a
 * `source` to bypass the cache (tests do this so they never depend on the machine's environment).
 */
export function loadConfig(source?: EnvSource): Config {
  if (source !== undefined) return parseEnv(envSchema, source);
  cached ??= parseEnv(envSchema, process.env);
  return cached;
}
