// Pure functions over the demo state: routes, progress, volunteer positions and the elderly ETA.

import {
  BLOCKS,
  CENTRE,
  LUNCH_ALREADY_DELIVERED,
  INITIAL_MESSAGES,
  SESSIONS,
  UNITS,
  VOLUNTEERS,
  type DemoBlock,
  type DemoMessage,
  type DemoSession,
  type DemoUnit,
  type PROBLEM_LABEL,
} from "@/data/mockData";
import { isDone } from "@/lib/checklist";
import { compareUnitsTopDown } from "@/lib/units";
import type { DeliveryStatus } from "@/types/db";
import { metresBetween, orderStops, pathMinutes, splitBySweep, type LatLng } from "./route";

// Elderly ETA: walking time to this unit plus this many minutes for each stop (undelivered unit) before it.
export const MINUTES_PER_STOP = 3;
// A shared position older than this is ignored (the phone probably went to sleep).
export const FRESH_LOCATION_MS = 5 * 60 * 1000;
// GPS further than this from the kitchen (e.g. testing at home) is ignored.
export const MAX_KM_FROM_CENTRE = 3;

export type ProblemKind = keyof typeof PROBLEM_LABEL;

export type Problem = {
  id: string;
  sessionId: string;
  unitId: string;
  volunteerId: string;
  kind: ProblemKind;
  note: string;
  time: string;
};

export type DemoLocation = LatLng & { updatedAt: string; simulated: boolean };

// volunteerId and elderlyUnitId belong to this browser tab. Everything else is shared through Supabase.
export type DemoState = {
  volunteerId: string; // who "you" are on the volunteer screens
  elderlyUnitId: string; // whose phone the elderly screen shows
  statuses: Record<string, DeliveryStatus>; // key: deliveryKey(session, unit)
  assignments: Record<string, Record<string, string>>; // session -> postal -> volunteer
  problems: Problem[];
  messages: DemoMessage[];
  locations: Record<string, DemoLocation>; // key: deliveryKey(session, volunteer)
  tokens: Record<string, string>; // unit id -> private link token
  nextId: number;
};

export const deliveryKey = (sessionId: string, unitId: string) => `${sessionId}:${unitId}`;

export const unitById = (id: string) => UNITS.find((u) => u.id === id)!;
export const blockByPostal = (postal: string) => BLOCKS.find((b) => b.postal === postal)!;
export const sessionById = (id: string) => SESSIONS.find((s) => s.id === id);
export const volunteerById = (id: string) => VOLUNTEERS.find((v) => v.id === id)!;

export const unitLabel = (u: DemoUnit) => `Blk ${blockByPostal(u.postal).blockNo} ${u.unitNo}`;

export function statusOf(state: DemoState, sessionId: string, unitId: string): DeliveryStatus {
  return state.statuses[deliveryKey(sessionId, unitId)] ?? "pending";
}

// Whole blocks split between the session team, balanced by number of units.
export function autoSplit(session: DemoSession): Record<string, string> {
  const counts = new Map<string, number>();
  for (const id of session.unitIds) {
    const postal = unitById(id).postal;
    counts.set(postal, (counts.get(postal) ?? 0) + 1);
  }
  const stops = [...counts].map(([postal, weight]) => ({ ...blockByPostal(postal), weight }));
  const groups = splitBySweep(CENTRE, stops, session.team.length);
  const result: Record<string, string> = {};
  groups.forEach((group, i) => group.forEach((b) => (result[b.postal] = session.team[i])));
  return result;
}

export type RouteStop = { stopNo: number; block: DemoBlock; units: DemoUnit[] };

// One volunteer's stops in delivery order. Same-block units are one stop, top floor first.
export function routeFor(state: DemoState, sessionId: string, volunteerId: string): RouteStop[] {
  const session = sessionById(sessionId);
  if (!session) return [];
  const assigned = state.assignments[sessionId] ?? {};
  const units = session.unitIds.map(unitById).filter((u) => assigned[u.postal] === volunteerId);
  const blocks = [...new Set(units.map((u) => u.postal))].map(blockByPostal);
  return orderStops(CENTRE, blocks).map((block, i) => ({
    stopNo: i + 1,
    block,
    units: units
      .filter((u) => u.postal === block.postal)
      .sort((a, b) => compareUnitsTopDown({ floor: a.floor, unit_no: a.unitNo }, { floor: b.floor, unit_no: b.unitNo })),
  }));
}

export function sessionProgress(state: DemoState, sessionId: string, volunteerId?: string) {
  const session = sessionById(sessionId);
  if (!session) return { delivered: 0, done: 0, total: 0 };
  const assigned = state.assignments[sessionId] ?? {};
  const ids = session.unitIds.filter((id) => !volunteerId || assigned[unitById(id).postal] === volunteerId);
  const statuses = ids.map((id) => statusOf(state, sessionId, id));
  return {
    delivered: statuses.filter((s) => s === "delivered").length,
    done: statuses.filter(isDone).length,
    total: ids.length,
  };
}

// The volunteer's shared position, if it is fresh and near Jurong West.
export function liveLocation(
  state: DemoState,
  sessionId: string,
  volunteerId: string,
  now = Date.now(),
): { location: DemoLocation; usable: boolean } | null {
  const location = state.locations[deliveryKey(sessionId, volunteerId)];
  if (!location || now - Date.parse(location.updatedAt) > FRESH_LOCATION_MS) return null;
  return { location, usable: metresBetween(CENTRE, location) <= MAX_KM_FROM_CENTRE * 1000 };
}

// Where a volunteer is: their shared position (GPS or simulated) when fresh and nearby,
// else the last block on their route with a ticked unit, else the centre.
export function volunteerPosition(
  state: DemoState,
  sessionId: string,
  volunteerId: string,
  now = Date.now(),
): {
  at: LatLng;
  label: string;
  live: boolean;
} {
  const live = liveLocation(state, sessionId, volunteerId, now);
  if (live?.usable) {
    return { at: live.location, label: live.location.simulated ? "Walking (simulated)" : "Live location", live: true };
  }
  const route = routeFor(state, sessionId, volunteerId);
  let at: { at: LatLng; label: string; live: boolean } = { at: CENTRE, label: "At the kitchen", live: false };
  for (const stop of route) {
    if (stop.units.some((u) => isDone(statusOf(state, sessionId, u.id)))) {
      at = { at: stop.block, label: `At Blk ${stop.block.blockNo}`, live: false };
    }
  }
  if (live) at.label += " (GPS is far from Jurong West)";
  return at;
}

export type ElderlyView =
  | { kind: "none" }
  | { kind: "preparing"; startTime: string }
  | { kind: "coming"; stopsAway: number; minutes: number }
  | { kind: "delivered" }
  | { kind: "missed" };

// What the recipient's phone shows for today's meal. It follows the earliest run today that is
// still going, so a lunch delivery shows "Delivered" until the whole lunch run is finished.
// ETA: walking time from where the volunteer is now, through the blocks of the stops still before
// this unit, to this unit's block, plus MINUTES_PER_STOP for each of those stops.
export function elderlyView(state: DemoState, unitId: string, now = Date.now()): ElderlyView {
  const today = SESSIONS.filter((s) => s.dayOffset === 0 && s.unitIds.includes(unitId)).sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );
  if (!today.length) return { kind: "none" };

  const session =
    today.find((s) => {
      const p = sessionProgress(state, s.id);
      return p.done < p.total;
    }) ?? today[today.length - 1];
  const status = statusOf(state, session.id, unitId);
  if (status === "delivered") return { kind: "delivered" };
  if (status !== "pending") return { kind: "missed" };

  const unit = unitById(unitId);
  const volunteerId = state.assignments[session.id]?.[unit.postal];
  if (!volunteerId) return { kind: "preparing", startTime: session.startTime };

  // Every undelivered unit before this one on the route is a stop to go.
  const ordered = routeFor(state, session.id, volunteerId).flatMap((s) => s.units);
  const ahead = ordered
    .slice(0, ordered.findIndex((u) => u.id === unitId))
    .filter((u) => statusOf(state, session.id, u.id) === "pending");

  const here = volunteerPosition(state, session.id, volunteerId, now).at;
  const path: LatLng[] = [here];
  for (const u of [...ahead, unit]) {
    const b = blockByPostal(u.postal);
    if (path[path.length - 1] !== b) path.push(b);
  }
  const minutes = Math.max(1, Math.round(pathMinutes(path) + MINUTES_PER_STOP * ahead.length));
  return { kind: "coming", stopsAway: ahead.length, minutes };
}

export function initialDemoState(): DemoState {
  const state: DemoState = {
    volunteerId: "v1",
    elderlyUnitId: "",
    statuses: {},
    assignments: Object.fromEntries(SESSIONS.map((s) => [s.id, autoSplit(s)])),
    problems: [],
    messages: INITIAL_MESSAGES,
    locations: {},
    tokens: {},
    nextId: 1,
  };

  // Start mid-session: the first few lunch units on each route are delivered.
  const lunch = SESSIONS[0];
  for (const v of lunch.team) {
    const units = routeFor(state, lunch.id, v).flatMap((s) => s.units);
    for (const u of units.slice(0, LUNCH_ALREADY_DELIVERED)) state.statuses[deliveryKey(lunch.id, u.id)] = "delivered";
  }

  state.elderlyUnitId = defaultElderlyUnit(state);
  return state;
}

// The elderly screen starts on a unit 3 stops away on the first volunteer's route (after a reset).
export function defaultElderlyUnit(state: DemoState): string {
  const lunch = SESSIONS[0];
  const firstRoute = routeFor(state, lunch.id, lunch.team[0]).flatMap((s) => s.units);
  return (firstRoute[LUNCH_ALREADY_DELIVERED + 3] ?? firstRoute[firstRoute.length - 1] ?? UNITS[0]).id;
}
