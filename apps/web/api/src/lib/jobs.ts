/*
 * The scheduler's door into the API. An Azure Logic App calls POST /api/jobs/reminders once a day
 * with a shared secret; this decides whether to let it in. Exists because Static Web Apps Free has
 * no timer triggers and the subscription had no Consumption-plan quota for a separate Function
 * App — so the schedule lives in a Logic App and the run lives here.
 *
 * The comparison is constant-time: a plain `===` on secrets leaks their length and prefix through
 * timing, and there is no reason to hand that out.
 */
import { timingSafeEqual } from "node:crypto";
import { AppError } from "@soccer/shared";

export function requireJobKey(
  presented: string | null | undefined,
  expected: string | undefined,
): void {
  if (!expected) {
    throw new AppError(
      "FORBIDDEN",
      "Scheduled jobs are not enabled.",
      "JOB_KEY is not set on the Static Web App; the Bicep sets it, so the app settings were not applied.",
    );
  }
  const a = Buffer.from(presented ?? "", "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new AppError(
      "FORBIDDEN",
      "Not allowed.",
      "x-job-key did not match JOB_KEY. If the Logic App was redeployed, both come from the same Bicep run — redeploy it.",
    );
  }
}
