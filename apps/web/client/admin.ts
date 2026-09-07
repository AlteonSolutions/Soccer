/*
 * The coach's page: add and remove games, see every sign-up with its email, release a slot.
 * Reached only through SWA authentication with the `admin` role; the API checks again.
 */
import type { AdminGame, RosterMember } from "@soccer/shared/schemas";
import { request, RequestError } from "./lib/api.js";
import { formatDate, formatKickoff } from "./lib/format.js";

const status = document.getElementById("status") as HTMLParagraphElement;
const rows = document.getElementById("rows") as HTMLTableSectionElement;
const addForm = document.getElementById("add-game") as HTMLFormElement;
const rosterList = document.getElementById("roster") as HTMLUListElement;
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
  const sub = document.createElement("span");
  sub.className = "sub";
  sub.textContent = game.location;
  when.append(sub);
  const email = cell(game.claim ? game.claim.email : "—");
  email.className = "mono";
  tr.append(when, cell(game.claim ? game.claim.parent_name : "—"), email);
  const actions = document.createElement("td");
  actions.className = "actions";
  if (game.claim) {
    actions.append(
      actionButton("Release Slot", "secondary", () =>
        request("DELETE", `/api/admin/claims/${game.id}`),
      ),
    );
  }
  actions.append(
    actionButton("Remove Game", "danger", async () => {
      if (!window.confirm(`Remove the game vs ${game.opponent} on ${formatDate(game.date)}?`))
        return;
      await request("DELETE", `/api/admin/games/${game.id}`);
    }),
  );
  tr.append(actions);
  return tr;
}

function renderMember(member: RosterMember): HTMLLIElement {
  const li = document.createElement("li");
  const email = document.createElement("span");
  email.className = "mono";
  email.textContent = member.email;
  li.append(
    email,
    actionButton("Remove", "danger", () =>
      request("DELETE", `/api/admin/roster/${encodeURIComponent(member.email)}`),
    ),
  );
  return li;
}

function renderRoster(members: RosterMember[]): void {
  rosterList.replaceChildren(...members.map(renderMember));
  if (members.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No addresses yet, so the Thursday reminder goes to nobody.";
    rosterList.append(li);
  }
}

async function load(): Promise<void> {
  try {
    const [{ games }, { members }] = await Promise.all([
      request<{ games: AdminGame[] }>("GET", "/api/admin/games"),
      request<{ members: RosterMember[] }>("GET", "/api/admin/roster"),
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
  const raw = String(new FormData(rosterForm).get("emails") ?? "");
  const emails = raw
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  const submit = rosterForm.querySelector("button[type=submit]") as HTMLButtonElement;
  submit.disabled = true;
  try {
    const { members } = await request<{ members: RosterMember[] }>("POST", "/api/admin/roster", {
      emails,
    });
    rosterForm.reset();
    renderRoster(members);
    setStatus(`${members.length} address${members.length === 1 ? "" : "es"} on the list.`);
  } catch (error) {
    report(error, "Could not add those addresses.");
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
    await request("POST", "/api/admin/games", {
      date: String(data.get("date") ?? ""),
      kickoff: String(data.get("kickoff") ?? ""),
      opponent: String(data.get("opponent") ?? ""),
      location: String(data.get("location") ?? ""),
    });
    addForm.reset();
    await load();
  } catch (error) {
    report(error, "Could not add the game.");
  } finally {
    submit.disabled = false;
  }
});

void load();
