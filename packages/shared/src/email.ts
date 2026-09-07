/*
 * Outbound email through Azure Communication Services, behind a capture-vs-send flag that
 * defaults to capture. Both audited projects that send mail invented this flag independently,
 * each after a test run emailed real people.
 *
 * `EMAIL_LIVE=off` (the default) or a missing ACS connection string means every message is
 * appended to an in-memory capture list and logged, never sent. Callers treat email as a secondary
 * side effect: catch `AppError EMAIL_FAILED`, log it, and let the primary action succeed.
 */
import { EmailClient } from "@azure/communication-email";
import { loadConfig } from "./config.js";
import { AppError } from "./errors.js";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailResult {
  /** "sent" went through ACS; "captured" was recorded locally and not delivered. */
  mode: "sent" | "captured";
  id: string;
}

export type SendEmail = (message: EmailMessage) => Promise<EmailResult>;

const captured: EmailMessage[] = [];

/** Every message captured since process start. For tests and the local dev log; never for prod. */
export function readCapturedEmails(): readonly EmailMessage[] {
  return captured;
}

export function clearCapturedEmails(): void {
  captured.length = 0;
}

let client: EmailClient | undefined;

export const sendEmail: SendEmail = async (message) => {
  const config = loadConfig();
  const live = config.EMAIL_LIVE === "on" && config.ACS_CONNECTION_STRING && config.EMAIL_FROM;
  if (!live) {
    captured.push(message);
    const id = `captured-${captured.length}`;
    console.info(
      JSON.stringify({ event: "email.captured", id, to: message.to, subject: message.subject }),
    );
    return { mode: "captured", id };
  }

  try {
    client ??= new EmailClient(config.ACS_CONNECTION_STRING as string);
    const poller = await client.beginSend({
      senderAddress: config.EMAIL_FROM as string,
      recipients: { to: [{ address: message.to }] },
      content: { subject: message.subject, plainText: message.text },
    });
    const result = await poller.pollUntilDone();
    if (result.status !== "Succeeded") {
      throw new Error(
        `ACS send finished with status ${result.status}: ${result.error?.message ?? "no detail"}`,
      );
    }
    console.info(
      JSON.stringify({
        event: "email.sent",
        id: result.id,
        to: message.to,
        subject: message.subject,
      }),
    );
    return { mode: "sent", id: result.id };
  } catch (error) {
    throw new AppError(
      "EMAIL_FAILED",
      "We could not send the email.",
      "ACS send failed. Check ACS_CONNECTION_STRING, that EMAIL_FROM is a verified sender on the email domain, and the ACS resource's status.",
      { cause: error },
    );
  }
};
