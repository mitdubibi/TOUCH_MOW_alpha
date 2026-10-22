import type { DemoSession } from "@/data/mockData";
import { addDays, formatDate, formatTime, SLOT_LABEL, todayInSingapore } from "@/lib/dates";

export function sessionDate(session: DemoSession): string {
  return addDays(todayInSingapore(), session.dayOffset);
}

// { day: "Today", date: "Thu, 15 Oct 2026", title: "Lunch · 8:30 am" }
export function sessionWhen(session: DemoSession) {
  const day = session.dayOffset === 0 ? "Today" : session.dayOffset === 1 ? "Tomorrow" : formatDate(sessionDate(session));
  return {
    day,
    date: formatDate(sessionDate(session)),
    title: `${SLOT_LABEL[session.slot]} · ${formatTime(session.startTime)}`,
    short: `${day} ${SLOT_LABEL[session.slot]}`,
  };
}
