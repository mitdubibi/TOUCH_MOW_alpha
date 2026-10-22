import { describe, expect, it } from "vitest";
import {
  bruteForce,
  decodePolyline,
  nearestNeighbour,
  orderStops,
  pathSeconds,
  twoOpt,
  type Cost,
} from "./optimise";

// Symmetric cost from straight-line distance between made-up points (index 0 is the centre).
const costFrom = (pts: [number, number][]): Cost => (i, j) => Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);

// Small seeded random so the tests are the same every run.
function points(n: number, seed: number): [number, number][] {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 100;
  return Array.from({ length: n + 1 }, () => [rand(), rand()]);
}

function permutations(xs: number[]): number[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

describe("bruteForce", () => {
  it("matches checking every order", () => {
    for (const seed of [1, 7, 42, 99]) {
      const cost = costFrom(points(6, seed));
      const best = Math.min(...permutations([1, 2, 3, 4, 5, 6]).map((p) => pathSeconds(p, cost)));
      expect(pathSeconds(bruteForce(6, cost), cost)).toBeCloseTo(best);
    }
  });

  it("walks a line in order from the centre", () => {
    const cost = costFrom([[0, 0], [3, 0], [1, 0], [2, 0]]);
    expect(bruteForce(3, cost)).toEqual([2, 3, 1]);
  });
});

describe("twoOpt", () => {
  it("removes a crossing", () => {
    // Centre at the left, four stops on a square. Visiting them in a Z crosses the path.
    const cost = costFrom([[0, 5], [10, 0], [10, 10], [20, 0], [20, 10]]);
    const crossing = [1, 4, 2, 3];
    const fixed = twoOpt(crossing, cost);
    expect(pathSeconds(fixed, cost)).toBeLessThan(pathSeconds(crossing, cost));
  });

  it("is never worse than nearest neighbour", () => {
    for (const seed of [3, 11, 23, 57, 101]) {
      const cost = costFrom(points(14, seed));
      const nn = nearestNeighbour(14, cost);
      expect(pathSeconds(twoOpt(nn, cost), cost)).toBeLessThanOrEqual(pathSeconds(nn, cost));
    }
  });
});

describe("orderStops", () => {
  it("uses brute force under 10 stops and 2-opt from 10", () => {
    expect(orderStops(9, costFrom(points(9, 5))).method).toBe("brute force");
    expect(orderStops(10, costFrom(points(10, 5))).method).toBe("nearest neighbour + 2-opt");
  });

  it("visits every stop once and beats or ties number order", () => {
    for (const n of [0, 1, 6, 12]) {
      const cost = costFrom(points(n, 13));
      const { order, seconds } = orderStops(n, cost);
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      expect(seconds).toBeLessThanOrEqual(pathSeconds(Array.from({ length: n }, (_, i) => i + 1), cost) + 1e-9);
    }
  });
});

describe("decodePolyline", () => {
  it("decodes Google's documented example", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });
});
