import { describe, expect, it } from "vitest";
import { CENTRE, LUNCH_ALREADY_DELIVERED, SESSIONS, UNITS } from "@/data/mockData";
import {
  autoSplit,
  blockByPostal,
  deliveryKey,
  elderlyView,
  initialDemoState,
  MINUTES_PER_STOP,
  routeFor,
  sessionProgress,
  unitById,
  volunteerPosition,
  type DemoState,
} from "./model";
import { orderStops, pathMinutes, splitBySweep } from "./route";
import { demoSeed, sgTimestamp } from "./seed";

const lunch = SESSIONS[0];

describe("splitBySweep", () => {
  it("puts every stop in exactly one group", () => {
    const stops = [0, 1, 2, 3, 4, 5].map((i) => ({
      lat: CENTRE.lat + Math.sin(i) / 1000,
      lng: CENTRE.lng + Math.cos(i) / 1000,
      weight: 3,
    }));
    const groups = splitBySweep(CENTRE, stops, 3);
    expect(groups.flat()).toHaveLength(6);
    expect(new Set(groups.flat()).size).toBe(6);
    expect(groups.every((g) => g.length > 0)).toBe(true);
  });
});

describe("orderStops", () => {
  it("visits the nearer stop first on a straight line", () => {
    const near = { lat: CENTRE.lat + 0.001, lng: CENTRE.lng };
    const far = { lat: CENTRE.lat + 0.003, lng: CENTRE.lng };
    expect(orderStops(CENTRE, [far, near])).toEqual([near, far]);
  });
});

describe("demo model", () => {
  it("auto split gives each block to one team member and roughly even units", () => {
    const split = autoSplit(lunch);
    const perVolunteer = lunch.team.map((v) => lunch.unitIds.filter((id) => split[unitById(id).postal] === v).length);
    expect(perVolunteer.reduce((a, b) => a + b)).toBe(UNITS.length);
    expect(Math.abs(perVolunteer[0] - perVolunteer[1])).toBeLessThanOrEqual(4);
  });

  it("routes put higher floors first within a block", () => {
    const state = initialDemoState();
    for (const stop of routeFor(state, lunch.id, "v1")) {
      const floors = stop.units.map((u) => u.floor);
      expect(floors).toEqual([...floors].sort((a, b) => b - a));
    }
  });

  it("elderly ETA counts down as units are ticked, then shows Delivered", () => {
    let state: DemoState = initialDemoState();
    const first = elderlyView(state, state.elderlyUnitId);
    expect(first).toMatchObject({ kind: "coming", stopsAway: 3 });

    const route = routeFor(state, lunch.id, "v1").flatMap((s) => s.units);
    const next = route.find((u) => !state.statuses[deliveryKey(lunch.id, u.id)])!;
    state = { ...state, statuses: { ...state.statuses, [deliveryKey(lunch.id, next.id)]: "delivered" } };
    expect(elderlyView(state, state.elderlyUnitId)).toMatchObject({ kind: "coming", stopsAway: 2 });

    state = { ...state, statuses: { ...state.statuses, [deliveryKey(lunch.id, state.elderlyUnitId)]: "delivered" } };
    expect(elderlyView(state, state.elderlyUnitId)).toEqual({ kind: "delivered" });
    expect(sessionProgress(state, lunch.id).delivered).toBe(sessionProgress(initialDemoState(), lunch.id).delivered + 2);
  });
});

describe("live location and ETA", () => {
  const NOW = Date.parse("2026-10-21T09:00:00+08:00");
  const at = (lat: number, lng: number, minutesAgo = 0) => ({
    lat,
    lng,
    simulated: true,
    updatedAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
  });

  it("uses a fresh nearby position, and ignores stale or far away ones", () => {
    const state = initialDemoState();
    const key = deliveryKey(lunch.id, "v1");
    const near = { ...state, locations: { [key]: at(CENTRE.lat + 0.001, CENTRE.lng) } };
    expect(volunteerPosition(near, lunch.id, "v1", NOW)).toMatchObject({ live: true, label: "Walking (simulated)" });

    const stale = { ...state, locations: { [key]: at(CENTRE.lat + 0.001, CENTRE.lng, 6) } };
    expect(volunteerPosition(stale, lunch.id, "v1", NOW).live).toBe(false);

    const far = { ...state, locations: { [key]: at(1.3521, 103.8198) } }; // central Singapore
    const pos = volunteerPosition(far, lunch.id, "v1", NOW);
    expect(pos.live).toBe(false);
    expect(pos.label).toContain("far from Jurong West");
  });

  it("is walking time to the unit plus 3 minutes per stop before it", () => {
    const state = initialDemoState();
    const unit = unitById(state.elderlyUnitId);
    const block = blockByPostal(unit.postal);
    const view = elderlyView(state, unit.id, NOW);
    expect(view).toMatchObject({ kind: "coming", stopsAway: 3 });

    // Volunteer standing at the recipient's block. The recipient is 7th on the route (3 delivered, 3 to go).
    const atBlock = { ...state, locations: { [deliveryKey(lunch.id, "v1")]: at(block.lat, block.lng) } };
    const ahead = routeFor(atBlock, lunch.id, "v1")
      .flatMap((s) => s.units)
      .slice(0, 6)
      .filter((u) => !atBlock.statuses[deliveryKey(lunch.id, u.id)]);
    const blocksAhead = [...new Set(ahead.map((u) => u.postal))];
    const walk = pathMinutes([block, ...[...blocksAhead, unit.postal].filter((p, i, a) => a[i - 1] !== p).map(blockByPostal)]);
    expect(elderlyView(atBlock, unit.id, NOW)).toEqual({
      kind: "coming",
      stopsAway: 3,
      minutes: Math.max(1, Math.round(walk + MINUTES_PER_STOP * 3)),
    });
  });
});

describe("demoSeed", () => {
  it("has every unit, every delivery, and the starting ticks", () => {
    const seed = demoSeed("2026-10-21");
    expect(seed.units).toHaveLength(UNITS.length);
    expect(seed.deliveries).toHaveLength(SESSIONS.reduce((n, s) => n + s.unitIds.length, 0));
    expect(seed.deliveries.filter((d) => d.status === "delivered")).toHaveLength(LUNCH_ALREADY_DELIVERED * lunch.team.length);
    expect(seed.deliveries.every((d) => d.status === "pending" || d.delivered_at)).toBe(true);
    expect(seed.sessions.find((s) => s.id === "s-tomorrow")!.date).toBe("2026-10-22");
    expect(seed.units.some((u) => "token" in u)).toBe(false);
  });

  it("turns message times into Singapore timestamps", () => {
    expect(sgTimestamp("2026-10-21", "7:45 am")).toBe("2026-10-20T23:45:00.000Z");
    expect(sgTimestamp("2026-10-21", "12:05 pm")).toBe("2026-10-21T04:05:00.000Z");
  });
});
