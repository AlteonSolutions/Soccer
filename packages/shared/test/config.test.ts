import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ConfigError, loadConfig, parseEnv } from "../src/config.js";

describe("loadConfig", () => {
  it("applies the documented defaults when nothing is set, so a fresh clone runs unconfigured", () => {
    const config = loadConfig({});
    expect(config.STORAGE_CONNECTION_STRING).toBe("UseDevelopmentStorage=true");
    expect(config.EMAIL_LIVE).toBe("off");
    expect(config.REMINDER_DAYS_AHEAD).toBe(2);
    expect(config.TIMEZONE).toBe("America/New_York");
  });

  it("treats an empty value as unset rather than as the empty string", () => {
    expect(loadConfig({ REMINDER_DAYS_AHEAD: "" }).REMINDER_DAYS_AHEAD).toBe(2);
  });

  it("rejects a malformed value by variable name", () => {
    expect(() => loadConfig({ REMINDER_DAYS_AHEAD: "30" })).toThrow(ConfigError);
    expect(() => loadConfig({ REMINDER_DAYS_AHEAD: "30" })).toThrow(/REMINDER_DAYS_AHEAD/);
    expect(() => loadConfig({ COACH_EMAIL: "not-an-address" })).toThrow(/COACH_EMAIL/);
  });

  it("refuses EMAIL_LIVE=on without the ACS connection string and sender", () => {
    expect(() => loadConfig({ EMAIL_LIVE: "on" })).toThrow(/EMAIL_LIVE/);
    expect(
      loadConfig({
        EMAIL_LIVE: "on",
        ACS_CONNECTION_STRING: "endpoint=x;accesskey=y",
        EMAIL_FROM: "a@b.co",
      }).EMAIL_LIVE,
    ).toBe("on");
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
