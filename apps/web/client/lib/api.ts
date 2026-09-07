/*
 * The client's only fetch wrapper. Every API error body has the shape in `apiErrorSchema`; this
 * turns it into an Error whose message is safe to show, and never renders the body as data.
 */
import type { ApiError } from "@soccer/shared/schemas";

export class RequestError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = (payload as Partial<ApiError> | undefined)?.error;
    throw new RequestError(
      error?.code ?? "UNKNOWN",
      error?.message ?? "Something went wrong. Please try again.",
    );
  }
  return payload as T;
}
