/*
 * The HTTP edge of the API in one place: JSON parsing with validation, and the one function that
 * turns any thrown value into a response. A route handler never builds an error body by hand, so
 * the client never receives a raw stack, a zod issue tree, or an Azure SDK message as if it were
 * data.
 */
import type { HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { AppError } from "@soccer/shared";
import type { z } from "zod";

export function json(status: number, body: unknown): HttpResponseInit {
  return { status, jsonBody: body };
}

/** Parse and validate the request body. Throws AppError VALIDATION with a form-safe message. */
export async function parseBody<T extends z.ZodType>(
  request: HttpRequest,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch (error) {
    throw new AppError(
      "VALIDATION",
      "The request was not valid JSON.",
      "Client sent a malformed body.",
      { cause: error },
    );
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    throw new AppError(
      "VALIDATION",
      `Please check the form. ${detail}`,
      "Client sent a body that failed schema validation.",
    );
  }
  return result.data;
}

/** Validate a route parameter. Throws AppError VALIDATION (a 400), never a raw ZodError (a 500). */
export function parseParam<T extends z.ZodType>(
  value: unknown,
  schema: T,
  name: string,
): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(
      "VALIDATION",
      `The ${name} in the address is not valid.`,
      `Route param ${name} failed validation.`,
    );
  }
  return result.data;
}

/** Map anything thrown to a response. Raw error to the log, user-safe message to the client. */
export function toErrorResponse(error: unknown, context: InvocationContext): HttpResponseInit {
  if (error instanceof AppError) {
    context.log(
      JSON.stringify({ event: "request.failed", code: error.code, remediation: error.remediation }),
    );
    if (error.cause) context.error(error.cause);
    return json(error.status, { error: { code: error.code, message: error.message } });
  }
  context.error(error);
  return json(500, {
    error: { code: "INTERNAL", message: "Something went wrong on our side. Please try again." },
  });
}
