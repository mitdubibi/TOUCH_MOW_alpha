import type { ReminderKind, Slot } from "../types/db";
import { addDays, formatDate, formatTime, SLOT_LABEL, todayInSingapore } from "./dates";

// Reminders go out at 7 pm the evening before, and 1 hour before the session starts.
export const EVENING_HOUR = 19;
const HOUR_MS = 3600_000;

// A Singapore date and clock time as a moment. Singapore is UTC+8 all year.
function sgMoment(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h - 8, min));
}

export function reminderTimes(date: string, startTime: string) {
  const start = sgMoment(date, startTime);
  return {
    start,
    evening_before: sgMoment(addDays(date, -1), `${EVENING_HOUR}:00`),
    hour_before: new Date(start.getTime() - HOUR_MS),
  };
}

// Which reminder is due now, if any. The two windows do not overlap, so a volunteer who is added
// late gets one reminder, never two at once:
//   evening_before: 7 pm the day before, until 1 hour before the start
//   hour_before:    1 hour before the start, until the start
export function dueReminder(date: string, startTime: string, now: Date): ReminderKind | null {
  const t = reminderTimes(date, startTime);
  if (now >= t.hour_before && now < t.start) return "hour_before";
  if (now >= t.evening_before && now < t.hour_before) return "evening_before";
  return null;
}

export type ReminderInput = {
  kind: ReminderKind;
  slot: Slot;
  date: string;
  startTime: string;
  centreName: string;
  address: string | null;
  postalCode: string;
  volunteerName?: string;
  // Link to the session checklist, for the email.
  link?: string;
};

// "today", "tomorrow" or "on Thu, 22 Oct 2026", relative to now in Singapore.
function dayWords(date: string, now: Date): string {
  const today = todayInSingapore(now);
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  return `on ${formatDate(date)}`;
}

export function reminderMessage(r: ReminderInput, now = new Date()) {
  const slot = SLOT_LABEL[r.slot];
  const time = formatTime(r.startTime);
  const title =
    r.kind === "hour_before"
      ? `Starting soon: ${slot} delivery at ${time}`
      : `Reminder: ${slot} delivery ${dayWords(r.date, now)} at ${time}`;
  const when = `${formatDate(r.date)}, ${time}`;
  const where = `${r.centreName}, ${r.address ?? `postal code ${r.postalCode}`}`;
  const text = [
    `Hi ${r.volunteerName || "there"},`,
    "",
    r.kind === "hour_before"
      ? `Your ${slot.toLowerCase()} delivery starts in about 1 hour.`
      : `You are delivering ${slot.toLowerCase()} meals ${dayWords(r.date, now)}.`,
    "",
    `When: ${when}`,
    `Collect the meals at: ${where}`,
    ...(r.link ? ["", `Your checklist and route: ${r.link}`] : []),
    "",
    "Thank you for volunteering with TOUCH Meals on Wheels.",
  ].join("\n");
  return { title, when, where, text };
}
