import { describe, expect, it } from "vitest";
import type { DeliveryStatus } from "@/types/db";
import { etaFor, type EtaUnit, type StoredRoute } from "./eta";

// Made-up route: centre, then blocks A, B, C (OneMap walking seconds from the previous stop).
const route: StoredRoute = {
  centre: { lat: 1.349, lng: 103.716 },
  totalSeconds: 540,
  stops: [
    { postalCode: "640001", lat: 1.35, lng: 103.717, legSeconds: 120 },
    { postalCode: "640002", lat: 1.351, lng: 103.718, legSeconds: 180 },
    { postalCode: "640003", lat: 1.352, lng: 103.719, legSeconds: 240 },
  ],
};

const unit = (id: string, postal: string, floor: number, status: DeliveryStatus = "pending"): EtaUnit => ({
  id,
  postal_code: postal,
  floor,
  unit_no: `#${String(floor).padStart(2, "0")}-${id}`,
  status,
});

const units = (statuses: Record<string, DeliveryStatus> = {}) => [
  unit("a1", "640001", 5, statuses.a1),
  unit("a2", "640001", 9, statuses.a2),
  unit("b1", "640002", 4, statuses.b1),
  unit("c1", "640003", 3, statuses.c1),
  unit("c2", "640003", 8, statuses.c2),
];

describe("etaFor", () => {
  it("counts every undelivered unit ahead, top floor first in a block", () => {
    // Ahead of c1: a2, a1, b1, c2. Walk A to B to C = 420 s = 7 min, plus 2 min per unit.
    expect(etaFor(route, units(), "c1", null)).toEqual({ stopsAway: 4, minutes: 15 });
  });

  it("skips units already done", () => {
    const eta = etaFor(route, units({ a1: "delivered", a2: "not_home" }), "c1", null);
    // Ahead: b1, c2. Walk B to C = 4 min, plus 2 x 2 min.
    expect(eta).toEqual({ stopsAway: 2, minutes: 8 });
  });

  it("says next when the volunteer is at the recipient's block", () => {
    const eta = etaFor(route, units({ a1: "delivered", a2: "delivered" }), "b1", { lat: 1.351, lng: 103.718 });
    expect(eta).toEqual({ stopsAway: 0, minutes: 1 });
  });

  it("adds the walk from the volunteer's position", () => {
    const done = units({ a1: "delivered", a2: "delivered" });
    const atCentre = etaFor(route, done, "b1", route.centre)!;
    const atBlock = etaFor(route, done, "b1", route.stops[1])!;
    expect(atCentre.minutes).toBeGreaterThan(atBlock.minutes);
  });

  it("ignores cancelled units and units not on the route", () => {
    const list = [...units({ c2: "cancelled" }), unit("x1", "649999", 2)];
    expect(etaFor(route, list, "c1", null)?.stopsAway).toBe(3);
    expect(etaFor(route, list, "x1", null)).toBeNull();
  });
});
