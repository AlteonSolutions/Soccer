import { describe, expect, it } from "vitest";
import { renderEmailHtml, textToHtml } from "../src/email-html.js";

const brand = {
  teamName: "Snack <City>",
  siteUrl: "https://example.org",
  badgeUrl: "https://example.org/logo.svg",
  wordmarkUrl: null,
};

describe("textToHtml", () => {
  it("makes paragraphs from blank lines, breaks from newlines, and keeps list indents", () => {
    const html = textToHtml("Hi,\n\nGames:\n  - one\n  - two\n\nBye\n");
    expect(html.match(/<p /g)).toHaveLength(3);
    expect(html).toContain("Games:<br />&nbsp;&nbsp;- one<br />&nbsp;&nbsp;- two");
  });

  it("escapes what the coach typed and links bare URLs", () => {
    const html = textToHtml("<b>bold</b> & see https://example.org/x.");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt; &amp; see");
    expect(html).toContain('<a href="https://example.org/x"');
    expect(html).not.toContain("<b>");
  });
});

describe("renderEmailHtml", () => {
  it("wraps the text in the branded layout with an escaped team name and a schedule button", () => {
    const html = renderEmailHtml(brand, "Subject <1>", "Hello there.");
    expect(html).toContain("Snack &lt;City&gt;");
    expect(html).toContain("<title>Subject &lt;1&gt;</title>");
    expect(html).toContain("Hello there.");
    expect(html).toContain('href="https://example.org"');
    expect(html).toContain("Open The Schedule");
    expect(html).toContain('src="https://example.org/logo.svg"');
    expect(html).not.toContain('alt="Snack Duty"');
  });

  it("adds the Snack Duty logo in the footer when one is uploaded", () => {
    const html = renderEmailHtml(
      { ...brand, wordmarkUrl: "https://example.org/api/assets/wordmark?v=1" },
      "s",
      "t",
    );
    expect(html).toContain('src="https://example.org/api/assets/wordmark?v=1" alt="Snack Duty"');
  });
});
