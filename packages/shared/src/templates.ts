/*
 * The email copy, as templates the coach can edit on the admin page. Each email has a subject and
 * a plain-text body with `{{placeholders}}`; `renderTemplate` fills them in. The defaults here are
 * what the site sends until the coach changes anything, and what "Reset" restores.
 *
 * Why templates rather than code: the wording of "please bring snacks" is the coach's, not ours,
 * and a season's worth of "can you change the Thursday email to say…" should not be a deploy.
 * Unknown placeholders are left in place on purpose, so a typo shows up in the email rather than
 * disappearing silently.
 */
import {
  recipientTokens,
  type EmailKind,
  type EmailTemplate,
  type EmailTemplates,
  type RecipientPlaceholder,
} from "./schemas.js";

export const DEFAULT_TEMPLATES: EmailTemplates = {
  claim_confirmation: {
    to: "{{parents}}",
    bcc: "",
    subject: "{{team}}: you're on snacks for {{date}}",
    text:
      "Hi,\n\n" +
      "{{player}}'s family is signed up to bring snacks for the {{team}} game on {{game}}.\n\n" +
      "We'll send one reminder on the Monday before. If plans change, let the coach know.\n\n" +
      "Schedule: {{site_url}}\n",
  },
  snack_reminder: {
    to: "{{parents}}",
    bcc: "",
    subject: "{{team}}: snacks this week – {{date}}",
    text:
      "Hi,\n\n" +
      "Quick reminder: {{player}}'s family is bringing snacks for the {{team}} game on {{game}}.\n\n" +
      "{{allergies}}\n\n" +
      "Thank you!\n\nSchedule: {{site_url}}\n",
  },
  // The whole team goes in BCC so no family sees another family's address.
  team_reminder: {
    to: "{{coach}}",
    bcc: "{{team_parents}}",
    subject: "{{team}}: game this Saturday vs {{opponent}}",
    text:
      "Hi {{team}} families,\n\n" +
      "Reminder: game on {{game}}.\n\n" +
      "{{snacks}}\n\n" +
      "See you there!\n\nSchedule: {{site_url}}\n",
  },
  coach_nudge: {
    to: "{{coach}}",
    bcc: "",
    subject: "{{team}}: {{count}} upcoming game(s) with no snack sign-up",
    text: "Nobody has signed up for snacks yet for:\n\n{{games}}\n\nSchedule: {{site_url}}\n",
  },
};

/** The placeholders each email understands, for the admin page's legend and for tests. */
export const TEMPLATE_PLACEHOLDERS: Record<EmailKind, Record<string, string>> = {
  claim_confirmation: {
    team: "the team name",
    player: "the player whose family signed up",
    game: "date, kickoff and opponent in one phrase",
    date: "the game date",
    kickoff: "the kickoff time",
    opponent: "the opponent",
    site_url: "the address of this site",
  },
  snack_reminder: {
    team: "the team name",
    player: "the player whose family is on snacks",
    game: "date, kickoff and opponent in one phrase",
    date: "the game date",
    kickoff: "the kickoff time",
    opponent: "the opponent",
    allergies: "a reminder of the team's food allergies, or nothing when there are none",
    site_url: "the address of this site",
  },
  team_reminder: {
    team: "the team name",
    game: "date, kickoff and opponent in one phrase",
    date: "the game date",
    kickoff: "the kickoff time",
    opponent: "the opponent",
    snacks: "the player whose family has snacks, or a note that the slot is open",
    site_url: "the address of this site",
  },
  coach_nudge: {
    team: "the team name",
    count: "how many games have no sign-up",
    games: "those games, one per line",
    site_url: "the address of this site",
  },
};

/** What the To and BCC placeholders stand for, per email, for the admin page's legend. */
export const RECIPIENT_LEGEND: Record<EmailKind, Record<RecipientPlaceholder, string>> = {
  claim_confirmation: {
    parents: "the parents of the player who signed up",
    team_parents: "every parent on the team list",
    coach: "the coach's email from Site Settings",
  },
  snack_reminder: {
    parents: "the parents of the player on snacks",
    team_parents: "every parent on the team list",
    coach: "the coach's email from Site Settings",
  },
  team_reminder: {
    parents: "the parents of the player on snacks (nobody when the slot is open)",
    team_parents: "every parent on the team list",
    coach: "the coach's email from Site Settings",
  },
  coach_nudge: {
    parents: "nobody – no game is picked out here",
    team_parents: "every parent on the team list",
    coach: "the coach's email from Site Settings",
  },
};

export const EMAIL_TITLES: Record<EmailKind, string> = {
  claim_confirmation: "Sign-Up Confirmation",
  snack_reminder: "Monday Snack Reminder",
  team_reminder: "Thursday Team Reminder",
  coach_nudge: "Monday Nudge To The Coach",
};

export interface RenderedEmail {
  subject: string;
  text: string;
}

/**
 * Fill `{{name}}` from `vars`. Placeholders not in `vars` stay as written. A placeholder that
 * fills in empty (no allergies this season) would leave a double blank line, so runs of blank
 * lines in the body collapse to one.
 */
export function renderTemplate(
  template: EmailTemplate,
  vars: Record<string, string>,
): RenderedEmail {
  const fill = (s: string) =>
    s.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (whole, name: string) =>
      Object.hasOwn(vars, name) ? (vars[name] as string) : whole,
    );
  return { subject: fill(template.subject), text: fill(template.text).replace(/\n{3,}/g, "\n\n") };
}

/** The address lists a To or BCC placeholder expands to, for one email. */
export type RecipientVars = Record<RecipientPlaceholder, readonly string[]>;

export interface Recipients {
  to: string[];
  bcc: string[];
}

/**
 * Expand a To or BCC line: each `{{placeholder}}` becomes its addresses, literals stay. Addresses
 * are de-duplicated, and anything already in To is dropped from BCC so nobody gets two copies.
 */
export function resolveRecipients(template: EmailTemplate, vars: RecipientVars): Recipients {
  const expand = (line: string): string[] => {
    const out: string[] = [];
    for (const token of recipientTokens(line)) {
      const m = /^\{\{\s*([a-z_]+)\s*\}\}$/.exec(token);
      if (m) out.push(...(vars[m[1] as RecipientPlaceholder] ?? []));
      else out.push(token);
    }
    return [...new Set(out.map((a) => a.trim().toLowerCase()).filter(Boolean))];
  };
  const to = expand(template.to);
  const seen = new Set(to);
  const bcc = expand(template.bcc).filter((a) => !seen.has(a));
  return { to, bcc };
}
