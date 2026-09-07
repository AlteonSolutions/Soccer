/*
 * The one error shape the whole codebase throws across a boundary: a stable `code` the client can
 * branch on, a `message` safe to show a parent, and `remediation` for the log. Raw upstream errors
 * are attached as `cause` and never leave the server.
 */
export type AppErrorCode =
  | "NOT_FOUND"
  | "ALREADY_CLAIMED"
  | "GAME_IN_PAST"
  | "VALIDATION"
  | "FORBIDDEN"
  | "DATA_UNAVAILABLE"
  | "EMAIL_FAILED";

// HTTP status per code, so routes never pick a number by hand.
const STATUS: Record<AppErrorCode, number> = {
  NOT_FOUND: 404,
  ALREADY_CLAIMED: 409,
  GAME_IN_PAST: 409,
  VALIDATION: 400,
  FORBIDDEN: 403,
  DATA_UNAVAILABLE: 503,
  EMAIL_FAILED: 502,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** For the log: what an operator should do about it. Never shown to a parent. */
  readonly remediation: string;

  constructor(
    code: AppErrorCode,
    message: string,
    remediation: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.remediation = remediation;
  }
}
