/*
 * The coach's page: add and remove games, see every sign-up with its email, release a slot.
 * Reached only through SWA authentication with the `admin` role; the API checks again.
 */
import type { AdminGame } from "@soccer/shared/schemas";
import { request, RequestError } from "./lib/api.js";
import { formatDate, formatKickoff } from "./lib/format.js";

const status = document.getElementById("status") as HTMLParagraphElement;
const rows = document.getElementById("rows") as HTMLTableSectionElement;
const addForm = document.getElementById("add-game") as HTMLFormElement;

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
  sub.textContent = game.notes ? `${game.location} — ${game.notes}` : game.location;
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

async function load(): Promise<void> {
  try {
    const { games } = await request<{ games: AdminGame[] }>("GET", "/api/admin/games");
    rows.replaceChildren(...games.map(renderRow));
    setStatus(games.length === 0 ? "No games yet. Add the first one above." : "");
  } catch (error) {
    report(error, "Could not load the games.");
  }
}

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
      notes: String(data.get("notes") ?? ""),
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
