// Rows for the shared demo tables (supabase/migrations/0007_demo_shared_data.sql), built from the
// fake data in mockData.ts. Pure: "Reset demo data" inserts what this returns.

import { INITIAL_MESSAGES, SESSIONS, UNITS, VOLUNTEERS } from "@/data/mockData";
import { addDays } from "@/lib/dates";
import { blockByPostal, deliveryKey, initialDemoState, routeFor } from "./model";

// "7:45 am" on a Singapore date -> ISO timestamp.
export function sgTimestamp(date: string, label: string): string {
  const m = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(label.trim());
  if (!m) throw new Error(`Not a time: ${label}`);
  const hour = (Number(m[1]) % 12) + (m[3].toLowerCase() === "pm" ? 12 : 0);
  return new Date(`${date}T${String(hour).padStart(2, "0")}:${m[2]}:00+08:00`).toISOString();
}

export function demoSeed(today: string) {
  const state = initialDemoState();

  const volunteers = VOLUNTEERS.map((v) => ({ id: v.id, name: v.name, initials: v.initials, colour: v.colour }));

  const sessions = SESSIONS.map((s) => ({
    id: s.id,
    date: addDays(today, s.dayOffset),
    slot: s.slot,
    start_time: s.startTime,
    team: s.team,
  }));

  // No token here: the database makes one, and a reset keeps it so elderly links keep working.
  const units = UNITS.map((u) => ({
    id: u.id,
    block_no: blockByPostal(u.postal).blockNo,
    unit_no: u.unitNo,
    floor: u.floor,
    postal_code: u.postal,
    meal_type: u.mealType,
    remarks: u.remarks,
    lang: u.lang,
  }));

  // The units already delivered at the start of lunch were done a few minutes apart, from 8:40 am.
  const deliveredAt = new Map<string, string>();
  for (const v of SESSIONS[0].team) {
    routeFor(state, SESSIONS[0].id, v)
      .flatMap((s) => s.units)
      .forEach((u, i) => deliveredAt.set(u.id, new Date(Date.parse(sgTimestamp(today, "8:40 am")) + i * 4 * 60_000).toISOString()));
  }

  const deliveries = SESSIONS.flatMap((s) =>
    s.unitIds.map((unitId) => {
      const status = state.statuses[deliveryKey(s.id, unitId)] ?? "pending";
      const unit = UNITS.find((u) => u.id === unitId)!;
      return {
        session_id: s.id,
        unit_id: unitId,
        assigned_volunteer: state.assignments[s.id]?.[unit.postal] ?? null,
        status,
        delivered_at: status === "pending" ? null : (deliveredAt.get(unitId) ?? null),
      };
    }),
  );

  const messages = INITIAL_MESSAGES.map((m) => ({
    thread: m.thread,
    sender: m.from,
    unit_id: m.unitId ?? null,
    body: m.body,
    created_at: sgTimestamp(today, m.time),
  }));

  return { volunteers, sessions, units, deliveries, messages };
}
