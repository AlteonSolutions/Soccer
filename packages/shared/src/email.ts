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
  to: string[];
  bcc: string[];
  subject: string;
  /** The plain-text body, always present: what the coach edits and what text-only clients show. */
  text: string;
  /** The branded HTML body (email-html.ts); the same words, laid out. */
  html?: string;
}

// Azure Communication Services accepts at most 50 recipients (To + CC + BCC) per message. A
// larger list goes out as several messages: the first carries To and the first BCCs, the rest
// BCC only, so the To recipient gets one copy and every BCC address gets exactly one.
export const MAX_RECIPIENTS_PER_MESSAGE = 50;

export function chunkRecipients(message: EmailMessage): EmailMessage[] {
  const all = [...message.to, ...message.bcc];
  if (all.length <= MAX_RECIPIENTS_PER_MESSAGE) return [message];
  const chunks: EmailMessage[] = [];
  const bcc = [...message.bcc];
  const firstBcc = bcc.splice(0, Math.max(0, MAX_RECIPIENTS_PER_MESSAGE - message.to.length));
  chunks.push({ ...message, bcc: firstBcc });
  while (bcc.length > 0) {
    chunks.push({ ...message, to: [], bcc: bcc.splice(0, MAX_RECIPIENTS_PER_MESSAGE) });
  }
  return chunks;
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
  if (message.to.length + message.bcc.length === 0) {
    throw new AppError(
      "EMAIL_FAILED",
      "This email has nobody to go to.",
      "A template's To and BCC lines resolved to no addresses; check the team list and the coach email.",
    );
  }
  const live = config.EMAIL_LIVE === "on" && config.ACS_CONNECTION_STRING && config.EMAIL_FROM;
  if (!live) {
    captured.push(message);
    const id = `captured-${captured.length}`;
    console.info(
      JSON.stringify({
        event: "email.captured",
        id,
        to: message.to,
        bcc_count: message.bcc.length,
        subject: message.subject,
      }),
    );
    return { mode: "captured", id };
  }

  try {
    client ??= new EmailClient(config.ACS_CONNECTION_STRING as string);
    let lastId = "";
    for (const chunk of chunkRecipients(message)) {
      const poller = await client.beginSend({
        senderAddress: config.EMAIL_FROM as string,
        recipients: {
          to: chunk.to.map((address) => ({ address })),
          bcc: chunk.bcc.map((address) => ({ address })),
        },
        content: { subject: message.subject, plainText: message.text, html: message.html },
      });
      const result = await poller.pollUntilDone();
      if (result.status !== "Succeeded") {
        throw new Error(
          `ACS send finished with status ${result.status}: ${result.error?.message ?? "no detail"}`,
        );
      }
      lastId = result.id;
      console.info(
        JSON.stringify({
          event: "email.sent",
          id: result.id,
          to: chunk.to,
          bcc_count: chunk.bcc.length,
          subject: message.subject,
        }),
      );
    }
    return { mode: "sent", id: lastId };
  } catch (error) {
    throw new AppError(
      "EMAIL_FAILED",
      "We could not send the email.",
      "ACS send failed. Check ACS_CONNECTION_STRING, that EMAIL_FROM is a verified sender on the email domain, and the ACS resource's status.",
      { cause: error },
    );
  }
};
