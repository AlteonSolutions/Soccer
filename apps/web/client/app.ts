/*
 * The public page: the schedule with a Sign Up button per open game. Rendering is plain DOM; the
 * logic worth testing is in lib/. State lives on the server — every action re-fetches.
 */
import type { PublicGame, ScheduleResponse } from "@soccer/shared/schemas";
import { request, RequestError } from "./lib/api.js";
import { dateParts, describeSnack, formatDate, formatKickoff } from "./lib/format.js";

const status = document.getElementById("status") as HTMLParagraphElement;
const list = document.getElementById("games") as HTMLUListElement;
const heading = document.getElementById("team-name") as HTMLHeadingElement;

function setStatus(text: string, isError = false): void {
  status.textContent = text;
  status.className = isError ? "status error" : "status";
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

let players: string[] = [];

/**
 * Two steps: pick the player from the team list, then confirm. No email is asked for — the
 * confirmation goes to the address the coach has on file for that player.
 */
function claimForm(game: PublicGame, onDone: () => void): HTMLFormElement {
  const form = document.createElement("form");
  form.className = "claim";
  form.innerHTML = `
    <label>Which Player?
      <select name="player" required>
        <option value="" selected disabled>Choose a player…</option>
      </select>
    </label>
    <p class="privacy">The confirmation and the Monday reminder go to the email the coach has on file for this player. Nothing is shown here.</p>
    <p class="confirm" hidden></p>
    <div class="actions">
      <button type="submit" class="primary" data-next>Continue</button>
      <button type="button" class="secondary" data-cancel>Cancel</button>
    </div>`;
  const select = form.querySelector("select") as HTMLSelectElement;
  for (const name of players) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.append(option);
  }
  const confirm = form.querySelector(".confirm") as HTMLParagraphElement;
  const next = form.querySelector("[data-next]") as HTMLButtonElement;
  const cancel = form.querySelector("[data-cancel]") as HTMLButtonElement;
  let confirming = false;

  cancel.addEventListener("click", () => {
    if (!confirming) return form.remove();
    confirming = false;
    confirm.hidden = true;
    select.disabled = false;
    next.textContent = "Continue";
    cancel.textContent = "Cancel";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const player = select.value;
    if (!player) return;
    if (!confirming) {
      confirming = true;
      select.disabled = true;
      confirm.textContent = `Sign up ${player}'s family to bring snacks on ${formatDate(game.date)} vs ${game.opponent}?`;
      confirm.hidden = false;
      next.textContent = "Yes, Sign Us Up";
      cancel.textContent = "Back";
      return;
    }
    next.disabled = true;
    try {
      await request("POST", "/api/claims", { game_id: game.id, player });
      setStatus(
        `${player}'s family is signed up for ${formatDate(game.date)}. A confirmation is on its way.`,
      );
      onDone();
    } catch (error) {
      setStatus(
        error instanceof RequestError ? error.message : "Something went wrong. Please try again.",
        true,
      );
      next.disabled = false;
      if (error instanceof RequestError && error.code === "ALREADY_CLAIMED") onDone();
    }
  });
  return form;
}

function renderGame(game: PublicGame, today: string): HTMLLIElement {
  const item = document.createElement("li");
  const past = game.date < today;
  item.className = past ? "game past" : "game";
  const parts = dateParts(game.date);
  item.innerHTML = `
    <div class="date-tile" aria-hidden="true">
      <span class="month"></span><span class="day"></span><span class="weekday"></span>
    </div>
    <div>
      <h2></h2>
      <p class="meta"><span class="kickoff"></span><span class="where"></span></p>
    </div>
    <div class="snack"></div>`;
  (item.querySelector(".month") as HTMLElement).textContent = parts.month;
  (item.querySelector(".day") as HTMLElement).textContent = parts.day;
  (item.querySelector(".weekday") as HTMLElement).textContent = parts.weekday;
  (item.querySelector("h2") as HTMLElement).textContent = `vs ${game.opponent}`;
  (item.querySelector(".kickoff") as HTMLElement).textContent =
    `${formatDate(game.date)} · ${formatKickoff(game.kickoff)}`;
  (item.querySelector(".where") as HTMLElement).textContent = game.location;

  const snack = item.querySelector(".snack") as HTMLElement;
  if (game.snack_by || past) {
    const pill = document.createElement("span");
    pill.className = game.snack_by ? "pill taken" : "pill played";
    pill.textContent = game.snack_by ? describeSnack(game) : "Played";
    snack.append(pill);
  } else {
    const button = document.createElement("button");
    button.className = "primary";
    button.textContent = "Sign Up";
    button.addEventListener("click", () => {
      item.querySelector("form.claim")?.remove();
      item.append(claimForm(game, () => void load()));
    });
    snack.append(button);
  }
  return item;
}

async function load(): Promise<void> {
  try {
    const schedule = await request<ScheduleResponse>("GET", "/api/games");
    heading.textContent = schedule.team_name;
    players = schedule.players;
    document.title = `${schedule.team_name} Snack Schedule`;
    list.replaceChildren(...schedule.games.map((g) => renderGame(g, todayIso())));
    if (schedule.games.length === 0) setStatus("No games on the schedule yet.");
    else if (players.length === 0)
      setStatus("The coach has not added the team list yet, so sign-ups are not open.");
    else if (status.className === "status" && status.textContent?.startsWith("Loading"))
      setStatus("");
  } catch (error) {
    setStatus(
      error instanceof RequestError
        ? error.message
        : "Could not load the schedule. Please try again.",
      true,
    );
  }
}

void load();
