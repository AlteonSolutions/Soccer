import { describe, expect, it } from "vitest";
import { chunkRecipients, MAX_RECIPIENTS_PER_MESSAGE } from "../src/email.js";

const addresses = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}@example.com`);

describe("chunkRecipients", () => {
  it("leaves a message within the limit alone", () => {
    const message = { to: ["a@example.com"], bcc: addresses(10, "b"), subject: "s", text: "t" };
    expect(chunkRecipients(message)).toEqual([message]);
  });

  it("splits a long BCC list so each address gets one copy and To gets exactly one", () => {
    const bcc = addresses(120, "p");
    const chunks = chunkRecipients({ to: ["coach@example.com"], bcc, subject: "s", text: "t" });
    expect(chunks.map((c) => c.to.length + c.bcc.length)).toEqual([50, 50, 21]);
    expect(chunks.every((c) => c.to.length + c.bcc.length <= MAX_RECIPIENTS_PER_MESSAGE)).toBe(
      true,
    );
    expect(chunks.flatMap((c) => c.to)).toEqual(["coach@example.com"]);
    expect(chunks.flatMap((c) => c.bcc)).toEqual(bcc);
  });
});
