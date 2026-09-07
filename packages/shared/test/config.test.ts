import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ConfigError, loadConfig, parseEnv } from "../src/config.js";

describe("loadConfig", () => {
  it("applies the documented defaults when nothing is set", () => {
    expect(loadConfig({})).toEqual({ NODE_ENV: "development", PORT: 3000, LOG_LEVEL: "info" });
  });

  it("treats an empty value as unset rather than as the empty string", () => {
    expect(loadConfig({ PORT: "" }).PORT).toBe(3000);
  });

  it("coerces PORT to a number and rejects one outside the TCP range by name", () => {
    expect(loadConfig({ PORT: "8080" }).PORT).toBe(8080);
    expect(() => loadConfig({ PORT: "70000" })).toThrow(ConfigError);
    expect(() => loadConfig({ PORT: "70000" })).toThrow(/PORT/);
  });

  it("ignores variables it does not declare, so the machine's environment never fails validation", () => {
    expect(() => loadConfig({ PATH: "/usr/bin", HOME: "/root" })).not.toThrow();
  });
});

describe("parseEnv", () => {
  const schema = z.object({ DATABASE_URL: z.string().min(1), PORT: z.coerce.number() }).strict();

  it("names every missing required variable at once, with remediation text", () => {
    let caught: unknown;
    try {
      parseEnv(schema, {});
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    const error = caught as ConfigError;
    expect(error.code).toBe("CONFIG_INVALID");
    expect(error.variables).toEqual(["DATABASE_URL", "PORT"]);
    expect(error.remediation).toContain(".env.example");
  });
});
