/*
 * The coach's page: add and remove games, see every sign-up with its email, release a slot.
 * Reached only through SWA authentication with the `admin` role; the API checks again.
 */
import type { AdminGame, ImportPreview, RosterMember } from "@soccer/shared/schemas";
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
const rosterForm = document.getElementById("add-roster") as HTMLFormElement;

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
  const email = cell(game.claim ? game.emails.join(", ") || "not on the team list" : "—");
  email.className = "mono";
  tr.append(when, cell(game.claim ? game.claim.player : "—"), email);
  const actions = document.createElement("td");
  actions.className = "actions";
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

function renderMember(member: RosterMember): HTMLLIElement {
  const li = document.createElement("li");
  const who = document.createElement("span");
  const name = document.createElement("strong");
  name.textContent = member.player;
  const emails = document.createElement("span");
  emails.className = "mono sub";
  emails.textContent = member.emails.join(" · ");
  who.append(name, emails);
  li.append(
    who,
    actionButton("Remove", "danger", () =>
      request("DELETE", `/api/coach/roster/${encodeURIComponent(member.player)}`),
    ),
  );
  return li;
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

async function load(): Promise<void> {
  try {
    const [{ games }, { members }] = await Promise.all([
      request<{ games: AdminGame[] }>("GET", "/api/coach/games"),
      request<{ members: RosterMember[] }>("GET", "/api/coach/roster"),
    ]);
    rows.replaceChildren(...games.map(renderRow));
    renderRoster(members);
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

void load();
