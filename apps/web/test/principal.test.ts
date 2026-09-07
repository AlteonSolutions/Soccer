import { describe, expect, it } from "vitest";
import { parsePrincipal, requireAdmin } from "../api/src/lib/principal.js";

function header(roles: string[]): string {
  return Buffer.from(
    JSON.stringify({
      identityProvider: "aad",
      userId: "u1",
      userDetails: "coach@example.com",
      userRoles: roles,
      claims: [],
    }),
  ).toString("base64");
}

describe("principal", () => {
  it("accepts the coach with the admin role", () => {
    expect(requireAdmin(header(["anonymous", "authenticated", "admin"])).userDetails).toBe(
      "coach@example.com",
    );
  });

  it("refuses an authenticated user without the admin role", () => {
    expect(() => requireAdmin(header(["anonymous", "authenticated"]))).toThrow(
      /sign in as the coach/,
    );
  });

  it("refuses anonymous and malformed headers without throwing anything but FORBIDDEN", () => {
    expect(parsePrincipal(null)).toBeUndefined();
    expect(parsePrincipal("not base64 json")).toBeUndefined();
    expect(() => requireAdmin(undefined)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
  });
});
