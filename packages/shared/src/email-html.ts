/*
 * The HTML body of every email: the coach's plain-text template, rendered, wrapped in a small
 * branded layout (team badge and name on a sky-blue band, the text as paragraphs, a button to the
 * schedule, the Snack Duty logo as a sign-off). The plain text still goes out alongside it for
 * clients that prefer it, so the coach keeps editing plain text with placeholders and never HTML.
 *
 * Email clients are not browsers: tables and inline styles only, no web fonts, no gradients that
 * matter, solid colours everywhere. Everything the coach typed is escaped before it goes in.
 */

export interface EmailBranding {
  teamName: string;
  siteUrl: string;
  /** Absolute URL of the badge; email clients fetch it from the site. */
  badgeUrl: string;
  /** Absolute URL of the Snack Duty logo, or null when none is uploaded. */
  wordmarkUrl: string | null;
}

// The site's palette, by hand: email clients do not read stylesheets.
const SKY = "#6cabdd";
const SKY_DEEP = "#3b86c4";
const SKY_TINT = "#eaf4fb";
const NAVY = "#1c2c5b";
const INK = "#16213a";
const MUTED = "#5f6b85";
const GROUND = "#f3f7fb";
const FONT = "Arial, Helvetica, sans-serif";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escaped text with http(s) URLs turned into links, so "Schedule: https://…" is clickable. */
function linkify(escaped: string): string {
  return escaped.replace(
    /https?:\/\/[^\s<]+[^\s<.,)]/g,
    (url) => `<a href="${url}" style="color:${SKY_DEEP};text-decoration:underline">${url}</a>`,
  );
}

/** Blank-line-separated paragraphs; single newlines become line breaks; leading spaces kept. */
export function textToHtml(text: string): string {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => {
      const lines = paragraph
        .split("\n")
        .map((line) =>
          linkify(escapeHtml(line)).replace(/^(\s+)/, (s) => "&nbsp;".repeat(s.length)),
        )
        .join("<br />");
      return `<p style="margin:0 0 1em;font:16px/1.55 ${FONT};color:${INK}">${lines}</p>`;
    })
    .join("");
}

export function renderEmailHtml(brand: EmailBranding, subject: string, text: string): string {
  const team = escapeHtml(brand.teamName);
  const site = escapeHtml(brand.siteUrl);
  const wordmark = brand.wordmarkUrl
    ? `<img src="${escapeHtml(brand.wordmarkUrl)}" alt="Snack Duty" height="72" style="height:72px;width:auto;display:block;margin:0 auto 8px" />`
    : "";
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${GROUND}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${GROUND}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td bgcolor="${SKY_DEEP}" style="background:${SKY_DEEP};padding:20px 28px">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td valign="middle" style="padding-right:16px"><img src="${escapeHtml(brand.badgeUrl)}" alt="" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:50%;background:#ffffff" /></td>
<td valign="middle"><div style="font:600 11px/1.2 ${FONT};letter-spacing:2px;text-transform:uppercase;color:${SKY_TINT}">Snack Duty</div>
<div style="font:800 24px/1.2 ${FONT};color:#ffffff">${team}</div></td>
</tr></table>
</td></tr>
<tr><td style="padding:28px 28px 8px">${textToHtml(text)}</td></tr>
<tr><td align="center" style="padding:8px 28px 28px">
<a href="${site}" style="display:inline-block;padding:12px 24px;border-radius:999px;background:${SKY_DEEP};color:#ffffff;font:700 16px/1 ${FONT};text-decoration:none">Open The Schedule</a>
</td></tr>
<tr><td bgcolor="${SKY_TINT}" style="background:${SKY_TINT};padding:18px 28px;text-align:center">
${wordmark}<div style="font:13px/1.5 ${FONT};color:${MUTED}">Snack Duty for ${team} &middot; <a href="${site}" style="color:${NAVY};text-decoration:none">${site}</a></div>
</td></tr>
</table>
<div style="height:1px;background:${SKY};width:0;opacity:0"></div>
</td></tr>
</table>
</body>
</html>
`;
}
