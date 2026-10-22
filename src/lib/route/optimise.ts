// Shortest one-way route from the collection centre. Pure functions, no network.
// Point 0 is the centre, points 1..n are the stops. cost(i, j) is walking seconds from i to j.

export type LatLng = { lat: number; lng: number };
export type Cost = (from: number, to: number) => number;
export type Method = "brute force" | "nearest neighbour + 2-opt";

export const BRUTE_FORCE_BELOW = 10;

// Total seconds walking from the centre through the stops in this order (stop indices, no 0).
export function pathSeconds(order: number[], cost: Cost): number {
  let total = 0;
  let here = 0;
  for (const stop of order) {
    total += cost(here, stop);
    here = stop;
  }
  return total;
}

export function orderStops(n: number, cost: Cost): { order: number[]; seconds: number; method: Method } {
  if (n < BRUTE_FORCE_BELOW) {
    const order = bruteForce(n, cost);
    return { order, seconds: pathSeconds(order, cost), method: "brute force" };
  }
  const order = twoOpt(nearestNeighbour(n, cost), cost);
  return { order, seconds: pathSeconds(order, cost), method: "nearest neighbour + 2-opt" };
}

// Tries every order, dropping any partial route already longer than the best full one.
export function bruteForce(n: number, cost: Cost): number[] {
  let best: number[] = [];
  let bestCost = Infinity;
  const used = new Array<boolean>(n + 1).fill(false);
  const prefix: number[] = [];

  const visit = (here: number, soFar: number) => {
    if (soFar >= bestCost) return;
    if (prefix.length === n) {
      best = [...prefix];
      bestCost = soFar;
      return;
    }
    for (let next = 1; next <= n; next++) {
      if (used[next]) continue;
      used[next] = true;
      prefix.push(next);
      visit(next, soFar + cost(here, next));
      prefix.pop();
      used[next] = false;
    }
  };
  visit(0, 0);
  return best;
}

// Always walk to the closest stop not visited yet.
export function nearestNeighbour(n: number, cost: Cost): number[] {
  const left = new Set(Array.from({ length: n }, (_, i) => i + 1));
  const order: number[] = [];
  let here = 0;
  while (left.size) {
    let best = -1;
    for (const s of left) if (best < 0 || cost(here, s) < cost(here, best)) best = s;
    left.delete(best);
    order.push(best);
    here = best;
  }
  return order;
}

// Reverse any stretch of the route that makes it shorter, until no reversal helps.
// The start (centre) stays first; the last stop may change because the route is one way.
export function twoOpt(order: number[], cost: Cost): number[] {
  let best = [...order];
  let bestCost = pathSeconds(best, cost);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        const c = pathSeconds(candidate, cost);
        if (c < bestCost - 1e-9) {
          best = candidate;
          bestCost = c;
          improved = true;
        }
      }
    }
  }
  return best;
}

// Google encoded polyline (precision 5), as returned by OneMap routing.
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
