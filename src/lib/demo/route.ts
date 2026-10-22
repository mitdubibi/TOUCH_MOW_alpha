// Geometry for routes and ETAs. Straight-line distance with a detour factor stands in
// for OneMap walking times until Feature 3.

export type LatLng = { lat: number; lng: number };

export const WALK_METRES_PER_MIN = 80;
export const DETOUR_FACTOR = 1.3;
export const MINUTES_PER_UNIT = 2;

export function metresBetween(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function walkMinutes(a: LatLng, b: LatLng): number {
  return (metresBetween(a, b) * DETOUR_FACTOR) / WALK_METRES_PER_MIN;
}

export function pathMinutes(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += walkMinutes(points[i - 1], points[i]);
  return total;
}

// Shortest one-way order from start: tries every order for up to 8 stops, else nearest neighbour.
export function orderStops<T extends LatLng>(start: LatLng, stops: T[]): T[] {
  if (stops.length <= 8) return bruteForce(start, stops);
  const left = [...stops];
  const out: T[] = [];
  let here = start;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) {
      if (metresBetween(here, left[i]) < metresBetween(here, left[best])) best = i;
    }
    const next = left.splice(best, 1)[0];
    out.push(next);
    here = next;
  }
  return out;
}

function bruteForce<T extends LatLng>(start: LatLng, stops: T[]): T[] {
  let best = stops;
  let bestCost = Infinity;
  const permute = (prefix: T[], rest: T[], cost: number) => {
    if (cost >= bestCost) return;
    if (!rest.length) {
      best = prefix;
      bestCost = cost;
      return;
    }
    const here = prefix.length ? prefix[prefix.length - 1] : start;
    rest.forEach((next, i) => {
      permute([...prefix, next], [...rest.slice(0, i), ...rest.slice(i + 1)], cost + metresBetween(here, next));
    });
  };
  permute([], stops, 0);
  return best;
}

// Splits stops into k groups that sit next to each other around the centre (a "pie slice" sweep),
// keeping the total weight (units) of each group about equal. Every stop lands in exactly one group.
export function splitBySweep<T extends LatLng & { weight: number }>(centre: LatLng, stops: T[], k: number): T[][] {
  const groups: T[][] = Array.from({ length: Math.max(1, k) }, () => []);
  if (!stops.length) return groups;

  const angle = (p: LatLng) => Math.atan2(p.lat - centre.lat, p.lng - centre.lng);
  const sorted = [...stops].sort((a, b) => angle(a) - angle(b));

  // Start the sweep after the widest empty gap so no group wraps around the centre.
  let startAt = 0;
  let widest = -1;
  for (let i = 0; i < sorted.length; i++) {
    const prev = sorted[(i - 1 + sorted.length) % sorted.length];
    let gap = angle(sorted[i]) - angle(prev);
    if (gap <= 0) gap += 2 * Math.PI;
    if (gap > widest) {
      widest = gap;
      startAt = i;
    }
  }
  const sweep = [...sorted.slice(startAt), ...sorted.slice(0, startAt)];

  const total = sweep.reduce((s, p) => s + p.weight, 0);
  let acc = 0;
  let g = 0;
  sweep.forEach((p, i) => {
    const stopsLeft = sweep.length - i;
    const groupsLeft = groups.length - g;
    const shareReached = acc + p.weight / 2 > (total * (g + 1)) / groups.length;
    if (g < groups.length - 1 && groups[g].length && (shareReached || stopsLeft < groupsLeft)) g++;
    groups[g].push(p);
    acc += p.weight;
  });
  return groups;
}
