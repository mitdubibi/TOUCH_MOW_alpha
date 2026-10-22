import type { Slot } from "@/types/db";

const SG = "Asia/Singapore";

export const SLOT_LABEL: Record<Slot, string> = { lunch: "Lunch", dinner: "Dinner" };

// Today's date in Singapore as YYYY-MM-DD.
export function todayInSingapore(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: SG }).format(now);
}

// addDays("2026-10-15", 1) -> "2026-10-16"
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// "2026-10-15" -> "15/10/2026", the date format in TOUCH's spreadsheets.
export function toDayMonthYear(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// "2026-10-15" -> "Thu, 15 Oct 2026"
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("en-SG", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

// "14:30:00" -> "2:30 pm"
export function formatTime(t: string): string {
  const [h, min] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(min).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

// A moment as Singapore clock time: "2026-10-21T11:05:00Z" -> "7:05 pm". Singapore has no daylight saving.
export function formatClock(at: string | Date): string {
  const sg = new Date(new Date(at).getTime() + 8 * 3600_000);
  return formatTime(sg.toISOString().slice(11, 16));
}
