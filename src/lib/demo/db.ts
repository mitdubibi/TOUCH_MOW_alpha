// Reading and writing the shared demo tables (supabase/migrations/0007_demo_shared_data.sql)
// from the browser. DEMO ONLY: open access with the anon key. Real login and security go in the
// table policies and here (see the real app's src/lib/deliveries.ts and its RLS).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DemoMessage } from "@/data/mockData";
import { formatClock } from "@/lib/dates";
import type { DeliveryStatus } from "@/types/db";
import { deliveryKey, type DemoLocation, type DemoState, type Problem, type ProblemKind } from "./model";

export type DeliveryRow = {
  session_id: string;
  unit_id: string;
  assigned_volunteer: string | null;
  status: DeliveryStatus;
  delivered_at: string | null;
};
export type LocationRow = {
  session_id: string;
  volunteer_id: string;
  lat: number;
  lng: number;
  simulated: boolean;
  updated_at: string;
};
export type MessageRow = {
  id: string;
  thread: string;
  sender: DemoMessage["from"];
  unit_id: string | null;
  body: string;
  created_at: string;
};
export type ProblemRow = {
  id: string;
  session_id: string;
  unit_id: string;
  volunteer_id: string | null;
  kind: ProblemKind;
  note: string;
  created_at: string;
};

// Shared part of the demo state (everything except who this browser tab is viewing as).
export type SharedState = Pick<DemoState, "statuses" | "assignments" | "problems" | "messages" | "locations" | "tokens"> & {
  hasData: boolean;
};

export const toMessage = (m: MessageRow): DemoMessage => ({
  id: m.id,
  thread: m.thread,
  from: m.sender,
  unitId: m.unit_id ?? undefined,
  body: m.body,
  time: formatClock(m.created_at),
});

export const toProblem = (p: ProblemRow): Problem => ({
  id: p.id,
  sessionId: p.session_id,
  unitId: p.unit_id,
  volunteerId: p.volunteer_id ?? "",
  kind: p.kind,
  note: p.note,
  time: formatClock(p.created_at),
});

export const toLocation = (l: LocationRow): DemoLocation => ({
  lat: l.lat,
  lng: l.lng,
  simulated: l.simulated,
  updatedAt: l.updated_at,
});

// Puts one delivery row into statuses and assignments (assignments are per block).
export function applyDelivery(
  state: Pick<DemoState, "statuses" | "assignments">,
  row: DeliveryRow,
  postalOf: (unitId: string) => string,
) {
  const statuses = { ...state.statuses, [deliveryKey(row.session_id, row.unit_id)]: row.status };
  const assignments = { ...state.assignments, [row.session_id]: { ...state.assignments[row.session_id] } };
  if (row.assigned_volunteer) assignments[row.session_id][postalOf(row.unit_id)] = row.assigned_volunteer;
  return { statuses, assignments };
}

export async function loadShared(supabase: SupabaseClient, postalOf: (unitId: string) => string): Promise<SharedState> {
  const [deliveries, locations, messages, problems, units] = await Promise.all([
    supabase.from("demo_deliveries").select("session_id, unit_id, assigned_volunteer, status, delivered_at").returns<DeliveryRow[]>(),
    supabase.from("demo_volunteer_locations").select("*").returns<LocationRow[]>(),
    supabase.from("demo_messages").select("*").order("created_at").returns<MessageRow[]>(),
    supabase.from("demo_problem_reports").select("*").order("created_at", { ascending: false }).returns<ProblemRow[]>(),
    supabase.from("demo_units").select("id, token").returns<{ id: string; token: string }[]>(),
  ]);
  const failed = [deliveries, locations, messages, problems, units].find((r) => r.error);
  if (failed?.error) throw failed.error;

  let ticks: Pick<DemoState, "statuses" | "assignments"> = { statuses: {}, assignments: {} };
  for (const row of deliveries.data!) ticks = applyDelivery(ticks, row, postalOf);

  return {
    ...ticks,
    locations: Object.fromEntries(locations.data!.map((l) => [deliveryKey(l.session_id, l.volunteer_id), toLocation(l)])),
    messages: messages.data!.map(toMessage),
    problems: problems.data!.map(toProblem),
    tokens: Object.fromEntries(units.data!.map((u) => [u.id, u.token])),
    hasData: deliveries.data!.length > 0,
  };
}
