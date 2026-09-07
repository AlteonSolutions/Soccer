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

function claimForm(game: PublicGame, onDone: () => void): HTMLFormElement {
  const form = document.createElement("form");
  form.className = "claim";
  form.innerHTML = `
    <label>Your Name <input name="parent_name" required maxlength="60" autocomplete="name" /></label>
    <label>Email <input name="email" type="email" required maxlength="254" autocomplete="email" /></label>
    <p class="privacy">Your email is only used for a confirmation and one reminder. It is never shown on this page.</p>
    <div class="actions">
      <button type="submit" class="primary">Sign Me Up</button>
      <button type="button" class="secondary" data-cancel>Cancel</button>
    </div>`;
  form.querySelector("[data-cancel]")?.addEventListener("click", () => form.remove());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const submit = form.querySelector("button[type=submit]") as HTMLButtonElement;
    submit.disabled = true;
    try {
      await request("POST", "/api/claims", {
        game_id: game.id,
        parent_name: String(data.get("parent_name") ?? ""),
        email: String(data.get("email") ?? ""),
      });
      setStatus(
        `You're signed up for ${formatDate(game.date)}. Check your email for a confirmation.`,
      );
      onDone();
    } catch (error) {
      setStatus(
        error instanceof RequestError ? error.message : "Something went wrong. Please try again.",
        true,
      );
      submit.disabled = false;
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
    document.title = `${schedule.team_name} Snack Schedule`;
    list.replaceChildren(...schedule.games.map((g) => renderGame(g, todayIso())));
    if (schedule.games.length === 0) setStatus("No games on the schedule yet.");
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
