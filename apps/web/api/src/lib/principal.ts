/*
 * Azure Static Web Apps authenticates the coach and forwards the result to the API as a base64
 * JSON header, `x-ms-client-principal`. SWA also blocks `/api/admin/*` for anyone without the
 * `admin` role in staticwebapp.config.json — this module is the second check, so that a
 * misconfigured route rule cannot silently expose parents' emails.
 */
import { AppError } from "@soccer/shared";
import { z } from "zod";

const principalSchema = z
  .object({
    identityProvider: z.string(),
    userId: z.string(),
    userDetails: z.string(),
    userRoles: z.array(z.string()),
  })
  .loose(); // SWA adds claims we do not use; do not reject them.

export type Principal = z.infer<typeof principalSchema>;

export const ADMIN_ROLE = "admin";

/** Decode the header; returns undefined for anonymous or malformed input rather than throwing. */
export function parsePrincipal(headerValue: string | null | undefined): Principal | undefined {
  if (!headerValue) return undefined;
  try {
    const decoded = Buffer.from(headerValue, "base64").toString("utf8");
    const result = principalSchema.safeParse(JSON.parse(decoded));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export function requireAdmin(headerValue: string | null | undefined): Principal {
  const principal = parsePrincipal(headerValue);
  if (!principal || !principal.userRoles.includes(ADMIN_ROLE)) {
    throw new AppError(
      "FORBIDDEN",
      "You need to sign in as the coach to do that.",
      "Caller lacks the SWA 'admin' role. Invite the coach with that role in the Static Web App's Role management blade.",
    );
  }
  return principal;
}
