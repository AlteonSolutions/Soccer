/*
 * The coach's page: add and remove games, see every sign-up with its email, release a slot.
 * Reached only through SWA authentication with the `admin` role; the API checks again.
 */
import type {
  AdminGame,
  EmailKind,
  EmailTemplates,
  ImportPreview,
  RosterImportPreview,
  RosterMember,
  Settings,
} from "@soccer/shared/schemas";
import { request, RequestError } from "./lib/api.js";
import { formatDate, formatKickoff } from "./lib/format.js";
import { parseRosterLines } from "./lib/roster.js";

const status = document.getElementById("status") as HTMLParagraphElement;
const rows = document.getElementById("rows") as HTMLTableSectionElement;
const addForm = document.getElementById("add-game") as HTMLFormElement;
const rosterList = document.getElementById("roster") as HTMLUListElement;
const importForm = document.getElementById("import-form") as HTMLFormElement;
const importPreview = document.getElementById("import-preview") as HTMLDivElement;
const importRows = document.getElementById("import-rows") as HTMLTableSectionElement;
const importSkipped = document.getElementById("import-skipped") as HTMLParagraphElement;
const importConfirm = document.getElementById("import-confirm") as HTMLButtonElement;
const importCancel = document.getElementById("import-cancel") as HTMLButtonElement;
const rosterImportForm = document.getElementById("roster-import-form") as HTMLFormElement;
const rosterPreview = document.getElementById("roster-preview") as HTMLDivElement;
const rosterPreviewRows = document.getElementById("roster-preview-rows") as HTMLTableSectionElement;
const rosterPreviewNotes = document.getElementById("roster-preview-notes") as HTMLParagraphElement;
const rosterImportConfirm = document.getElementById("roster-import-confirm") as HTMLButtonElement;
const rosterImportCancel = document.getElementById("roster-import-cancel") as HTMLButtonElement;
const rosterForm = document.getElementById("add-roster") as HTMLFormElement;
const settingsForm = document.getElementById("settings-form") as HTMLFormElement;
const logoForm = document.getElementById("logo-form") as HTMLFormElement;
const logoReset = document.getElementById("logo-reset") as HTMLButtonElement;
const logoPreview = document.getElementById("logo-preview") as HTMLImageElement;
const templatesForm = document.getElementById("templates-form") as HTMLFormElement;
const templatesBox = document.getElementById("templates") as HTMLDivElement;
const badge = document.querySelector(".hero .badge") as HTMLImageElement;
const favicon = document.querySelector("link[rel=icon]") as HTMLLinkElement;

interface EmailKindInfo {
  kind: EmailKind;
  title: string;
  placeholders: Record<string, string>;
}

interface SettingsResponse {
  settings: Settings;
  default_templates: EmailTemplates;
  emails: EmailKindInfo[];
}

interface EmailPreview {
  subject: string;
  text: string;
  based_on: { game: string; player: string };
}

function setStatus(text: string, isError = false): void {
  status.textContent = text;
  status.className = isError ? "status error" : "status";
}

function report(error: unknown, fallback: string): void {
  setStatus(error instanceof RequestError ? error.message : fallback, true);
}

function cell(text: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.textContent = text;
  return td;
}

function actionButton(
  label: string,
  className: string,
  onClick: () => Promise<void>,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await onClick();
      await load();
    } catch (error) {
      report(error, "That did not work. Please try again.");
      button.disabled = false;
    }
  });
  return button;
}

function renderRow(game: AdminGame): HTMLTableRowElement {
  const tr = document.createElement("tr");
  const when = cell(
    `${formatDate(game.date)} · ${formatKickoff(game.kickoff)} vs ${game.opponent}`,
  );
  const email = cell(game.claim ? game.emails.join(", ") || "not on the team list" : "–");
  email.className = "mono";
  tr.append(when, cell(game.claim ? game.claim.player : "–"), email);
  const actions = document.createElement("td");
  actions.className = "actions";
  // Not actionButton: that helper reloads the table after the click, which would erase the editor.
  const edit = document.createElement("button");
  edit.className = "secondary";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => void editRow(tr, game));
  actions.append(edit);
  if (game.claim) {
    actions.append(
      actionButton("Release Slot", "secondary", () =>
        request("DELETE", `/api/coach/claims/${game.id}`),
      ),
    );
  }
  actions.append(
    actionButton("Remove Game", "danger", async () => {
      if (!window.confirm(`Remove the game vs ${game.opponent} on ${formatDate(game.date)}?`))
        return;
      await request("DELETE", `/api/coach/games/${game.id}`);
    }),
  );
  tr.append(actions);
  return tr;
}

/** Swap a schedule row for inline inputs; Save sends the edit, Cancel redraws the row. */
async function editRow(tr: HTMLTableRowElement, game: AdminGame): Promise<void> {
  tr.replaceChildren();
  const editor = document.createElement("td");
  editor.colSpan = 3;
  editor.innerHTML = `
    <form class="row-edit">
      <label>Date <input name="date" type="date" required /></label>
      <label>Kickoff <input name="kickoff" type="time" required /></label>
      <label>Opponent <input name="opponent" required maxlength="80" /></label>
    </form>`;
  const form = editor.querySelector("form") as HTMLFormElement;
  (form.elements.namedItem("date") as HTMLInputElement).value = game.date;
  (form.elements.namedItem("kickoff") as HTMLInputElement).value = game.kickoff;
  (form.elements.namedItem("opponent") as HTMLInputElement).value = game.opponent;
  const actions = document.createElement("td");
  actions.className = "actions";
  const save = document.createElement("button");
  save.className = "primary";
  save.textContent = "Save";
  save.addEventListener("click", async () => {
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    save.disabled = true;
    try {
      await request("PUT", `/api/coach/games/${game.id}`, {
        date: String(data.get("date") ?? ""),
        kickoff: String(data.get("kickoff") ?? ""),
        opponent: String(data.get("opponent") ?? ""),
      });
      await load();
      setStatus("Game updated.");
    } catch (error) {
      report(error, "Could not save that game.");
      save.disabled = false;
    }
  });
  const cancel = document.createElement("button");
  cancel.className = "secondary";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => tr.replaceWith(renderRow(game)));
  actions.append(save, cancel);
  tr.append(editor, actions);
  (form.elements.namedItem("opponent") as HTMLInputElement).focus();
}

function renderMember(member: RosterMember): HTMLLIElement {
  const li = document.createElement("li");
  const who = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = member.player;
  const emails = document.createElement("span");
  emails.className = "mono sub";
  emails.textContent = member.emails.join(" · ");
  who.append(name, emails);
  const buttons = document.createElement("span");
  buttons.className = "row-buttons";
  const edit = document.createElement("button");
  edit.className = "secondary";
  edit.textContent = "Edit";
  edit.addEventListener("click", () => editMember(li, member));
  buttons.append(
    edit,
    actionButton("Remove", "danger", () =>
      request("DELETE", `/api/coach/roster/${encodeURIComponent(member.player)}`),
    ),
  );
  li.append(who, buttons);
  return li;
}

/** Swap a team-list row for inline inputs: the player's name and the parent emails. */
function editMember(li: HTMLLIElement, member: RosterMember): void {
  li.replaceChildren();
  li.className = "editing";
  const form = document.createElement("form");
  form.className = "row-edit";
  form.innerHTML = `
    <label>Player <input name="player" required maxlength="60" /></label>
    <label>Parent Emails (comma-separated) <input name="emails" required /></label>`;
  (form.elements.namedItem("player") as HTMLInputElement).value = member.player;
  (form.elements.namedItem("emails") as HTMLInputElement).value = member.emails.join(", ");
  const buttons = document.createElement("span");
  buttons.className = "row-buttons";
  const save = document.createElement("button");
  save.className = "primary";
  save.textContent = "Save";
  save.addEventListener("click", async () => {
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const emails = String(data.get("emails") ?? "")
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    save.disabled = true;
    try {
      const { members } = await request<{ members: RosterMember[] }>(
        "PUT",
        `/api/coach/roster/${encodeURIComponent(member.player)}`,
        { player: String(data.get("player") ?? ""), emails },
      );
      renderRoster(members);
      await load();
      setStatus("Player updated.");
    } catch (error) {
      report(error, "Could not save that player.");
      save.disabled = false;
    }
  });
  const cancel = document.createElement("button");
  cancel.className = "secondary";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => li.replaceWith(renderMember(member)));
  buttons.append(save, cancel);
  li.append(form, buttons);
  (form.elements.namedItem("player") as HTMLInputElement).focus();
}

function renderRoster(members: RosterMember[]): void {
  rosterList.replaceChildren(...members.map(renderMember));
  if (members.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent =
      "No players yet, so nobody can sign up and the Thursday reminder goes to nobody.";
    rosterList.append(li);
  }
}

// ---- Site settings: team name, allergy note, badge, and the email templates. The list of emails,
// their titles and placeholder legends come from the API, so the page holds no copy of that text.
let defaultTemplates: EmailTemplates | undefined;
let emailKinds: EmailKindInfo[] = [];

function templateField(kind: EmailKind, field: "subject" | "text"): HTMLInputElement {
  return templatesBox.querySelector(`[name="${kind}.${field}"]`) as HTMLInputElement;
}

function renderTemplateEditors(): void {
  templatesBox.replaceChildren(
    ...emailKinds.map(({ kind, title, placeholders }) => {
      const panel = document.createElement("details");
      panel.className = "tools";
      const summary = document.createElement("summary");
      summary.textContent = title;
      const body = document.createElement("div");
      body.className = "tool template";
      body.innerHTML = `
        <label>Subject <input required maxlength="200" /></label>
        <label>Body <textarea required maxlength="4000" rows="8"></textarea></label>
        <p class="placeholders"></p>
        <div class="actions">
          <button type="button" class="primary" data-preview>Preview</button>
          <button type="button" class="secondary" data-reset>Reset To Default</button>
        </div>
        <div class="email-preview" hidden>
          <p class="based-on"></p>
          <p class="subject"></p>
          <pre></pre>
        </div>`;
      (body.querySelector("input") as HTMLInputElement).name = `${kind}.subject`;
      (body.querySelector("textarea") as HTMLTextAreaElement).name = `${kind}.text`;
      const legend = body.querySelector(".placeholders") as HTMLParagraphElement;
      legend.append("You can use: ");
      Object.entries(placeholders).forEach(([name, meaning], i) => {
        const code = document.createElement("code");
        code.textContent = `{{${name}}}`;
        legend.append(i === 0 ? "" : " · ", code, ` ${meaning}`);
      });
      (body.querySelector("[data-reset]") as HTMLButtonElement).addEventListener("click", () => {
        if (!defaultTemplates) return;
        templateField(kind, "subject").value = defaultTemplates[kind].subject;
        templateField(kind, "text").value = defaultTemplates[kind].text;
      });
      const previewButton = body.querySelector("[data-preview]") as HTMLButtonElement;
      const previewBox = body.querySelector(".email-preview") as HTMLDivElement;
      previewButton.addEventListener("click", async () => {
        previewButton.disabled = true;
        try {
          const preview = await request<EmailPreview>("POST", "/api/coach/settings/preview", {
            team_name: (settingsForm.elements.namedItem("team_name") as HTMLInputElement).value,
            kind,
            template: {
              subject: templateField(kind, "subject").value,
              text: templateField(kind, "text").value,
            },
          });
          (previewBox.querySelector(".based-on") as HTMLElement).textContent =
            `Filled in from the game on ${preview.based_on.game} and ${preview.based_on.player}'s family. This is how the email reads as typed; save to use it.`;
          (previewBox.querySelector(".subject") as HTMLElement).textContent =
            `Subject: ${preview.subject}`;
          (previewBox.querySelector("pre") as HTMLElement).textContent = preview.text;
          previewBox.hidden = false;
        } catch (error) {
          report(error, "Could not preview that email.");
        } finally {
          previewButton.disabled = false;
        }
      });
      panel.append(summary, body);
      return panel;
    }),
  );
}

function renderBadge(settings: Settings): void {
  const src = settings.logo_updated_at
    ? `/api/logo?v=${encodeURIComponent(settings.logo_updated_at)}`
    : "/logo.svg";
  if (badge.getAttribute("src") !== src) badge.src = src;
  logoPreview.src = src;
  favicon.href = src;
  logoReset.disabled = !settings.logo_updated_at;
}

function renderSettings({ settings, default_templates, emails }: SettingsResponse): void {
  defaultTemplates = default_templates;
  emailKinds = emails;
  if (templatesBox.childElementCount === 0) renderTemplateEditors();
  (settingsForm.elements.namedItem("team_name") as HTMLInputElement).value = settings.team_name;
  (settingsForm.elements.namedItem("allergies") as HTMLTextAreaElement).value = settings.allergies;
  for (const { kind } of emailKinds) {
    templateField(kind, "subject").value = settings.templates[kind].subject;
    templateField(kind, "text").value = settings.templates[kind].text;
  }
  renderBadge(settings);
}

/** Everything on both forms, as one settings body: each Save button sends the whole thing. */
function collectSettings(): {
  team_name: string;
  allergies: string;
  templates: Record<EmailKind, { subject: string; text: string }>;
} {
  const templates = Object.fromEntries(
    emailKinds.map(({ kind }) => [
      kind,
      { subject: templateField(kind, "subject").value, text: templateField(kind, "text").value },
    ]),
  ) as Record<EmailKind, { subject: string; text: string }>;
  return {
    team_name: (settingsForm.elements.namedItem("team_name") as HTMLInputElement).value,
    allergies: (settingsForm.elements.namedItem("allergies") as HTMLInputElement).value,
    templates,
  };
}

async function saveSettings(form: HTMLFormElement, done: string): Promise<void> {
  const submit = form.querySelector("button[type=submit]") as HTMLButtonElement;
  submit.disabled = true;
  try {
    renderSettings(
      await request<SettingsResponse>("PUT", "/api/coach/settings", collectSettings()),
    );
    setStatus(done);
  } catch (error) {
    report(error, "Could not save the settings.");
  } finally {
    submit.disabled = false;
  }
}

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveSettings(settingsForm, "Settings saved. The sign-up page shows them on its next load.");
});

templatesForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void saveSettings(templatesForm, "Templates saved. The next emails use them.");
});

logoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = logoForm.querySelector("input[name=image]") as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const submit = logoForm.querySelector("button[type=submit]") as HTMLButtonElement;
  submit.disabled = true;
  try {
    const response = await fetch("/api/coach/logo", {
      method: "POST",
      headers: { "content-type": file.type || "application/octet-stream" },
      body: file,
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = (payload as { error?: { message?: string } } | undefined)?.error;
      throw new RequestError("UPLOAD", error?.message ?? "Could not upload that image.");
    }
    logoForm.reset();
    renderBadge(payload as Settings);
    setStatus("Badge updated.");
  } catch (error) {
    report(error, "Could not upload that image.");
  } finally {
    submit.disabled = false;
  }
});

logoReset.addEventListener("click", async () => {
  logoReset.disabled = true;
  try {
    renderBadge(await request<Settings>("DELETE", "/api/coach/logo"));
    setStatus("Back to the default badge.");
  } catch (error) {
    report(error, "Could not remove the badge.");
    logoReset.disabled = false;
  }
});

async function load(): Promise<void> {
  try {
    const [{ games }, { members }, settings] = await Promise.all([
      request<{ games: AdminGame[] }>("GET", "/api/coach/games"),
      request<{ members: RosterMember[] }>("GET", "/api/coach/roster"),
      request<SettingsResponse>("GET", "/api/coach/settings"),
    ]);
    rows.replaceChildren(...games.map(renderRow));
    renderRoster(members);
    renderSettings(settings);
    setStatus(games.length === 0 ? "No games yet. Add the first one above." : "");
  } catch (error) {
    report(error, "Could not load the games.");
  }
}

rosterForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const parsed = parseRosterLines(String(new FormData(rosterForm).get("lines") ?? ""));
  if (parsed.length === 0) {
    setStatus(
      "Each line needs a player name, then one or more parent emails, separated by commas.",
      true,
    );
    return;
  }
  const submit = rosterForm.querySelector("button[type=submit]") as HTMLButtonElement;
  submit.disabled = true;
  try {
    const { members } = await request<{ members: RosterMember[] }>("POST", "/api/coach/roster", {
      members: parsed,
    });
    rosterForm.reset();
    renderRoster(members);
    setStatus(`${members.length} player${members.length === 1 ? "" : "s"} on the team list.`);
  } catch (error) {
    report(error, "Could not add those players.");
  } finally {
    submit.disabled = false;
  }
});

addForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(addForm);
  const submit = addForm.querySelector("button[type=submit]") as HTMLButtonElement;
  submit.disabled = true;
  try {
    await request("POST", "/api/coach/games", {
      date: String(data.get("date") ?? ""),
      kickoff: String(data.get("kickoff") ?? ""),
      opponent: String(data.get("opponent") ?? ""),
    });
    addForm.reset();
    await load();
  } catch (error) {
    report(error, "Could not add the game.");
  } finally {
    submit.disabled = false;
  }
});

// ---- Schedule import: upload → preview → confirm. The server parses; the page only shows.
let pendingImport: ImportPreview | undefined;

const IMPORT_LABEL = { new: "Add", unchanged: "Keep As Is", changed: "Update Kickoff" } as const;

function renderImportPreview(preview: ImportPreview): void {
  pendingImport = preview;
  importRows.replaceChildren(
    ...preview.games.map((g) => {
      const tr = document.createElement("tr");
      tr.append(cell(formatDate(g.date)), cell(formatKickoff(g.kickoff)), cell(g.opponent));
      const status = document.createElement("td");
      const pill = document.createElement("span");
      pill.className = `pill ${g.status === "unchanged" ? "played" : "taken"}`;
      pill.textContent = IMPORT_LABEL[g.status];
      status.append(pill);
      tr.append(status);
      return tr;
    }),
  );
  importSkipped.hidden = preview.skipped.length === 0;
  importSkipped.textContent =
    preview.skipped.length === 0
      ? ""
      : `Could not read ${preview.skipped.length} line${preview.skipped.length === 1 ? "" : "s"}: ${preview.skipped.join(" · ")}`;
  const toWrite = preview.games.filter((g) => g.status !== "unchanged").length;
  importConfirm.textContent =
    toWrite === 0 ? "Nothing To Import" : `Import ${toWrite} Game${toWrite === 1 ? "" : "s"}`;
  importConfirm.disabled = toWrite === 0;
  importPreview.hidden = false;
}

importForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = (importForm.querySelector("input[name=pdf]") as HTMLInputElement).files?.[0];
  if (!file) return;
  const submit = importForm.querySelector("button[type=submit]") as HTMLButtonElement;
  submit.disabled = true;
  setStatus("Reading the schedule…");
  try {
    const response = await fetch("/api/coach/schedule/parse", {
      method: "POST",
      headers: { "content-type": "application/pdf" },
      body: file,
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = (payload as { error?: { message?: string } } | undefined)?.error;
      throw new RequestError("PARSE", error?.message ?? "Could not read that file.");
    }
    const preview = payload as ImportPreview;
    renderImportPreview(preview);
    setStatus(
      preview.games.length === 0
        ? "No games were found in that PDF. Is it the league schedule?"
        : `Found ${preview.games.length} game${preview.games.length === 1 ? "" : "s"}. Check the list, then import.`,
      preview.games.length === 0,
    );
  } catch (error) {
    report(error, "Could not read that file.");
  } finally {
    submit.disabled = false;
  }
});

importConfirm.addEventListener("click", async () => {
  if (!pendingImport) return;
  const games = pendingImport.games
    .filter((g) => g.status !== "unchanged")
    .map(({ date, kickoff, opponent }) => ({ date, kickoff, opponent }));
  importConfirm.disabled = true;
  try {
    const { imported } = await request<{ imported: number }>("POST", "/api/coach/games/bulk", {
      games,
    });
    importPreview.hidden = true;
    importForm.reset();
    pendingImport = undefined;
    await load();
    setStatus(`Imported ${imported} game${imported === 1 ? "" : "s"}.`);
  } catch (error) {
    report(error, "Could not import the games.");
    importConfirm.disabled = false;
  }
});

importCancel.addEventListener("click", () => {
  importPreview.hidden = true;
  importForm.reset();
  pendingImport = undefined;
  setStatus("");
});

// ---- Roster import: upload → preview → confirm, writing through the same endpoint as the paste box.
let pendingRoster: RosterImportPreview | undefined;
const ROSTER_LABEL = { new: "Add", unchanged: "Keep As Is", changed: "Update Emails" } as const;

function renderRosterPreview(preview: RosterImportPreview): void {
  pendingRoster = preview;
  rosterPreviewRows.replaceChildren(
    ...preview.members.map((m) => {
      const tr = document.createElement("tr");
      const emails = cell(m.emails.join(", "));
      emails.className = "mono";
      tr.append(cell(m.player), emails);
      const status = document.createElement("td");
      const pill = document.createElement("span");
      pill.className = `pill ${m.status === "unchanged" ? "played" : "taken"}`;
      pill.textContent = ROSTER_LABEL[m.status];
      status.append(pill);
      tr.append(status);
      return tr;
    }),
  );
  const notes: string[] = [];
  if (preview.no_email.length)
    notes.push(`No email in the PDF for ${preview.no_email.join(", ")} – add them by hand below.`);
  if (preview.truncated.length)
    notes.push(`Only the first four addresses were kept for ${preview.truncated.join(", ")}.`);
  rosterPreviewNotes.hidden = notes.length === 0;
  rosterPreviewNotes.textContent = notes.join(" ");
  const toWrite = preview.members.filter((m) => m.status !== "unchanged").length;
  rosterImportConfirm.textContent =
    toWrite === 0 ? "Nothing To Import" : `Import ${toWrite} Player${toWrite === 1 ? "" : "s"}`;
  rosterImportConfirm.disabled = toWrite === 0;
  rosterPreview.hidden = false;
}

rosterImportForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = (rosterImportForm.querySelector("input[name=pdf]") as HTMLInputElement).files?.[0];
  if (!file) return;
  const submit = rosterImportForm.querySelector("button[type=submit]") as HTMLButtonElement;
  submit.disabled = true;
  setStatus("Reading the roster…");
  try {
    const response = await fetch("/api/coach/roster/parse", {
      method: "POST",
      headers: { "content-type": "application/pdf" },
      body: file,
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = (payload as { error?: { message?: string } } | undefined)?.error;
      throw new RequestError("PARSE", error?.message ?? "Could not read that file.");
    }
    const preview = payload as RosterImportPreview;
    renderRosterPreview(preview);
    const found = preview.members.length + preview.no_email.length;
    setStatus(
      found === 0
        ? "No players were found in that PDF. Is it the league roster?"
        : `Found ${found} player${found === 1 ? "" : "s"}. Check the list, then import.`,
      found === 0,
    );
  } catch (error) {
    report(error, "Could not read that file.");
  } finally {
    submit.disabled = false;
  }
});

rosterImportConfirm.addEventListener("click", async () => {
  if (!pendingRoster) return;
  // Every player goes, unchanged ones included, so the team list takes the league's order.
  const members = pendingRoster.members.map(({ player, emails }, position) => ({
    player,
    emails,
    position,
  }));
  rosterImportConfirm.disabled = true;
  try {
    const { members: all } = await request<{ members: RosterMember[] }>(
      "POST",
      "/api/coach/roster",
      { members },
    );
    rosterPreview.hidden = true;
    rosterImportForm.reset();
    pendingRoster = undefined;
    renderRoster(all);
    setStatus(
      `Imported ${members.length} player${members.length === 1 ? "" : "s"}. ${all.length} on the team list.`,
    );
  } catch (error) {
    report(error, "Could not import the players.");
    rosterImportConfirm.disabled = false;
  }
});

rosterImportCancel.addEventListener("click", () => {
  rosterPreview.hidden = true;
  rosterImportForm.reset();
  pendingRoster = undefined;
  setStatus("");
});

void load();
