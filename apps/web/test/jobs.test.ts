import { describe, expect, it } from "vitest";
import { requireJobKey } from "../api/src/lib/jobs.js";

const key = "0123456789abcdef0123456789abcdef";

describe("requireJobKey", () => {
  it("lets the exact key through", () => {
    expect(() => requireJobKey(key, key)).not.toThrow();
  });

  it("refuses a wrong, partial, or missing key, and a disabled endpoint, all as FORBIDDEN", () => {
    for (const presented of ["x", key.slice(0, -1), key + "0", null, undefined, ""]) {
      expect(() => requireJobKey(presented, key)).toThrow(
        expect.objectContaining({ code: "FORBIDDEN" }),
      );
    }
    expect(() => requireJobKey(key, undefined)).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });
});
