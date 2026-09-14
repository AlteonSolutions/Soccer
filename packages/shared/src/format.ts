/*
 * How a date and a kickoff read to a parent, in one place for the pages and the emails alike:
 * "9/19" and "10:00 AM". No Intl, no Date: a YYYY-MM-DD string passed to `new Date()` is parsed
 * as UTC midnight and renders as the previous evening in US time zones, and an email rendered on
 * the server must say the same thing as the page. No dependencies, so the browser bundles it.
 */

/** "9/19" from "2026-09-19". No day of the week, no year: the season is short and everyone knows. */
export function formatDate(dateIso: string): string {
  const [, m, d] = dateIso.split("-").map(Number) as [number, number, number];
  return `${m}/${d}`;
}

/** The pieces of a calendar tile: "SEP", "19" – from "2026-09-19", no time-zone shift. */
export function dateParts(dateIso: string): { month: string; day: string } {
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const [, m, d] = dateIso.split("-").map(Number) as [number, number, number];
  return { month: months[m - 1] ?? "", day: String(d) };
}

/** "10:00 AM" from "10:00". */
export function formatKickoff(kickoff: string): string {
  const [h, min] = kickoff.split(":").map(Number) as [number, number];
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(min).padStart(2, "0")} ${suffix}`;
}

/** The coach's comma-separated allergy setting as a clean list; empty means none. */
export function allergyList(allergies: string): string[] {
  return allergies
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
}

/** "peanut", "peanut and tree nut", "peanut, tree nut and egg". */
export function joinWithAnd(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
