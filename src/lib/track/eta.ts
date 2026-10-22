// "The volunteer is N stops away, about X minutes." Pure functions, no database.
// Every undelivered unit before this one on the volunteer's route counts as a stop
// (the same rule as the /demo elderly screen).

import { DETOUR_FACTOR, MINUTES_PER_UNIT, WALK_METRES_PER_MIN, metresBetween } from "@/lib/demo/route";
import type { LatLng } from "@/lib/route/optimise";
import { compareUnitsTopDown } from "@/lib/units";
import type { DeliveryStatus } from "@/types/db";

// What start_delivery saves in session_volunteers.route.
export type StoredRoute = {
  centre: LatLng;
  totalSeconds: number;
  stops: (LatLng & { postalCode: string; legSeconds: number })[];
};

export type EtaUnit = { id: string; postal_code: string; floor: number; unit_no: string; status: DeliveryStatus };

// A position older than this is ignored (the phone probably went to sleep).
export const FRESH_LOCATION_MS = 5 * 60 * 1000;

const straightLineSeconds = (a: LatLng, b: LatLng) =>
  ((metresBetween(a, b) * DETOUR_FACTOR) / WALK_METRES_PER_MIN) * 60;

// here: the volunteer's latest position, or null if not known.
export function etaFor(
  route: StoredRoute,
  units: EtaUnit[],
  targetId: string,
  here: LatLng | null,
): { stopsAway: number; minutes: number } | null {
  // Units in walking order: blocks in route order, top floor first inside a block.
  const ordered = route.stops.flatMap((stop) =>
    units.filter((u) => u.postal_code === stop.postalCode && u.status !== "cancelled").sort(compareUnitsTopDown),
  );
  const at = ordered.findIndex((u) => u.id === targetId);
  if (at < 0) return null;

  const ahead = ordered.slice(0, at).filter((u) => u.status === "pending");

  // Blocks still to walk to, ending at the recipient's block.
  const blocks: string[] = [];
  for (const u of [...ahead, ordered[at]]) {
    if (blocks[blocks.length - 1] !== u.postal_code) blocks.push(u.postal_code);
  }
  const stopIndex = (postal: string) => route.stops.findIndex((s) => s.postalCode === postal);

  let seconds = here ? straightLineSeconds(here, route.stops[stopIndex(blocks[0])]) : 0;
  for (let k = 1; k < blocks.length; k++) {
    const from = stopIndex(blocks[k - 1]);
    const to = stopIndex(blocks[k]);
    // Next block on the planned route: use OneMap's walking time. Otherwise estimate.
    seconds += to === from + 1 ? route.stops[to].legSeconds : straightLineSeconds(route.stops[from], route.stops[to]);
  }

  const minutes = Math.max(1, Math.round(seconds / 60 + MINUTES_PER_UNIT * ahead.length));
  return { stopsAway: ahead.length, minutes };
}
