// What a recipient's private link shows. Recipients have no login, so this runs on the server
// with the service role and only ever returns the status of the one unit the token belongs to.

import { todayInSingapore } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DeliveryStatus, SessionStatus } from "@/types/db";
import { etaFor, FRESH_LOCATION_MS, type EtaUnit, type StoredRoute } from "./eta";

export type Lang = "en" | "zh";

export type TrackView =
  | { kind: "invalid" }
  | { kind: "none" }
  | { kind: "preparing"; startTime: string }
  // stopsAway/minutes are missing when the volunteer's route is not known yet.
  | { kind: "coming"; stopsAway?: number; minutes?: number }
  | { kind: "delivered" }
  | { kind: "missed" };

type TodayRow = {
  id: string;
  status: DeliveryStatus;
  assigned_to: string | null;
  sessions: { id: string; start_time: string; status: SessionStatus };
};
type TeamRow = { volunteer_id: string; route: StoredRoute | null; sharing_location: boolean };
type LocationRow = { volunteer_id: string; lat: number; lng: number; updated_at: string };
type SessionUnitRow = {
  id: string;
  status: DeliveryStatus;
  assigned_to: string | null;
  units: { unit_no: string; floor: number; postal_code: string };
};

export async function trackStatus(token: string): Promise<{ view: TrackView; lang: Lang }> {
  if (!/^[0-9a-f]{64}$/.test(token)) return { view: { kind: "invalid" }, lang: "en" };
  const admin = createAdminClient();

  const { data: contact } = await admin
    .from("unit_contacts")
    .select("unit_id, lang, token_revoked_at")
    .eq("track_token", token)
    .maybeSingle<{ unit_id: string; lang: Lang; token_revoked_at: string | null }>();
  if (!contact || contact.token_revoked_at) return { view: { kind: "invalid" }, lang: "en" };
  const lang = contact.lang;

  const { data, error } = await admin
    .from("deliveries")
    .select("id, status, assigned_to, sessions!inner(id, date, start_time, status)")
    .eq("unit_id", contact.unit_id)
    .eq("sessions.date", todayInSingapore())
    .neq("status", "cancelled")
    .returns<TodayRow[]>();
  if (error) throw error;
  const today = [...data].sort((a, b) => a.sessions.start_time.localeCompare(b.sessions.start_time));

  // 1. A meal on its way right now.
  const live = today.find((d) => d.status === "pending" && d.sessions.status === "live");
  if (live) return { view: await coming(admin, live), lang };

  // 2. The latest meal today that is finished (delivered, or missed).
  const finished = today.filter((d) => d.status !== "pending" || d.sessions.status === "done").at(-1);
  if (finished) return { view: { kind: finished.status === "delivered" ? "delivered" : "missed" }, lang };

  // 3. A meal later today that has not started.
  const planned = today.find((d) => d.status === "pending");
  if (planned) return { view: { kind: "preparing", startTime: planned.sessions.start_time }, lang };

  return { view: { kind: "none" }, lang };
}

async function coming(admin: ReturnType<typeof createAdminClient>, delivery: TodayRow): Promise<TrackView> {
  const sessionId = delivery.sessions.id;
  const [team, locations, sessionUnits] = await Promise.all([
    admin.from("session_volunteers").select("volunteer_id, route, sharing_location").eq("session_id", sessionId).returns<TeamRow[]>(),
    admin.from("volunteer_locations").select("volunteer_id, lat, lng, updated_at").eq("session_id", sessionId).returns<LocationRow[]>(),
    admin
      .from("deliveries")
      .select("id, status, assigned_to, units!inner(unit_no, floor, postal_code)")
      .eq("session_id", sessionId)
      .returns<SessionUnitRow[]>(),
  ]);

  // Volunteers who could bring this meal: the one it is assigned to, or anyone if not split yet.
  const candidates = (team.data ?? []).filter(
    (v) => v.route && (!delivery.assigned_to || delivery.assigned_to === v.volunteer_id),
  );

  let best: { stopsAway: number; minutes: number; sharing: boolean } | null = null;
  for (const v of candidates) {
    const units: EtaUnit[] = (sessionUnits.data ?? [])
      .filter((d) => !d.assigned_to || d.assigned_to === v.volunteer_id)
      .map((d) => ({ id: d.id, status: d.status, ...d.units }));
    const loc = (locations.data ?? []).find((l) => l.volunteer_id === v.volunteer_id);
    const fresh = v.sharing_location && loc && Date.now() - Date.parse(loc.updated_at) < FRESH_LOCATION_MS;
    const eta = etaFor(v.route!, units, delivery.id, fresh ? loc : null);
    if (!eta) continue;
    const sharing = Boolean(fresh);
    // Prefer someone who is out delivering right now, then the shortest wait.
    if (!best || (sharing && !best.sharing) || (sharing === best.sharing && eta.minutes < best.minutes)) {
      best = { ...eta, sharing };
    }
  }
  return best ? { kind: "coming", stopsAway: best.stopsAway, minutes: best.minutes } : { kind: "coming" };
}
