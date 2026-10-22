// Plans the walking route for the deliveries the viewer can see (RLS decides which).
// OneMap results are cached in blocks, centres and walk_times; the order itself is recomputed each time.

import type { SupabaseClient } from "@supabase/supabase-js";
import { geocodePostal, mapLimit, walkRoute } from "@/lib/onemap";
import { createAdminClient } from "@/lib/supabase/admin";
import { compareBlockNumbers } from "@/lib/units";
import type { ChecklistItem } from "@/types/db";
import { decodePolyline, orderStops, pathSeconds, type LatLng, type Method } from "./optimise";

const ONEMAP_PARALLEL = 4;

export type RouteStop = LatLng & {
  stopNo: number;
  postalCode: string;
  blockNo: string;
  legSeconds: number;
  legMetres: number;
  legPath: LatLng[];
};

export type RoutePlan =
  | {
      ok: true;
      centre: LatLng & { name: string; postalCode: string };
      stops: RouteStop[];
      // Blocks OneMap could not find. They go last on the checklist.
      unmapped: { postalCode: string; blockNo: string }[];
      totalSeconds: number;
      totalMetres: number;
      // Same blocks walked in block number order, for comparison.
      naiveSeconds: number;
      method: Method;
    }
  | { ok: false; error: string };

type CentreRow = {
  id: string;
  name: string;
  postal_code: string;
  lat: number | null;
  lng: number | null;
  geocoded_at: string | null;
};
type BlockRow = { postal_code: string; block_no: string; lat: number | null; lng: number | null; geocoded_at: string | null };
type WalkRow = { from_postal: string; to_postal: string; seconds: number; metres: number | null; path: string | null };

const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export async function planRoute(supabase: SupabaseClient, sessionId: string, items: ChecklistItem[]): Promise<RoutePlan> {
  try {
    return await plan(supabase, sessionId, items);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`Route ${sessionId}: ${error}`);
    return { ok: false, error };
  }
}

async function plan(supabase: SupabaseClient, sessionId: string, items: ChecklistItem[]): Promise<RoutePlan> {
  let oneMapCalls = 0;
  let admin: SupabaseClient | null = null;
  const writer = () => (admin ??= createAdminClient());

  // 1. The collection centre and the blocks on this list.
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("centres(id, name, postal_code, lat, lng, geocoded_at)")
    .eq("id", sessionId)
    .single<{ centres: CentreRow | null }>();
  if (sessionError) throw sessionError;
  const centre = session.centres;
  if (!centre) throw new Error("This session has no collection centre");

  const postals = [...new Set(items.filter((i) => i.status !== "cancelled").map((i) => i.postal_code))];
  const { data: blockRows, error: blocksError } = await supabase
    .from("blocks")
    .select("postal_code, block_no, lat, lng, geocoded_at")
    .in("postal_code", postals.length ? postals : [""])
    .returns<BlockRow[]>();
  if (blocksError) throw blocksError;
  const blocks = new Map(blockRows.map((b) => [b.postal_code, b]));

  // 2. Geocode anything OneMap has not been asked about yet.
  const toGeocode = blockRows.filter((b) => !b.geocoded_at);
  if (toGeocode.length) {
    const found = await mapLimit(toGeocode, ONEMAP_PARALLEL, (b) => {
      oneMapCalls++;
      return geocodePostal(b.postal_code);
    });
    const now = new Date().toISOString();
    const rows = toGeocode.map((b, i) => ({
      postal_code: b.postal_code,
      block_no: b.block_no,
      street: found[i]?.street ?? null,
      lat: found[i]?.lat ?? null,
      lng: found[i]?.lng ?? null,
      geocoded_at: now,
    }));
    const { error } = await writer().from("blocks").upsert(rows);
    if (error) throw error;
    for (const r of rows) blocks.set(r.postal_code, { ...r });
  }
  if (!centre.geocoded_at) {
    oneMapCalls++;
    const g = await geocodePostal(centre.postal_code);
    const row = { lat: g?.lat ?? null, lng: g?.lng ?? null, geocoded_at: new Date().toISOString() };
    const { error } = await writer().from("centres").update(row).eq("id", centre.id);
    if (error) throw error;
    Object.assign(centre, row);
  }
  if (centre.lat == null || centre.lng == null) {
    throw new Error(`OneMap could not find the centre's postal code ${centre.postal_code}`);
  }

  // Index 0 is the centre, 1..n are the blocks OneMap found.
  type Point = LatLng & { postal: string; blockNo: string };
  const start: Point = { postal: centre.postal_code, blockNo: "", lat: centre.lat, lng: centre.lng };
  const stops: Point[] = [];
  const unmapped: { postalCode: string; blockNo: string }[] = [];
  for (const postal of postals) {
    const b = blocks.get(postal);
    if (b && b.lat != null && b.lng != null) stops.push({ postal, blockNo: b.block_no, lat: b.lat, lng: b.lng });
    else unmapped.push({ postalCode: postal, blockNo: b?.block_no ?? postal });
  }
  const points = [start, ...stops];

  // 3. Walking times between every pair of points, from the cache or OneMap.
  const coords = new Map(points.map((p) => [p.postal, p]));
  const allPostals = [...coords.keys()];
  const { data: walkRows, error: walkError } = await supabase
    .from("walk_times")
    .select("from_postal, to_postal, seconds, metres, path")
    .in("from_postal", allPostals)
    .in("to_postal", allPostals)
    .returns<WalkRow[]>();
  if (walkError) throw walkError;
  const walks = new Map(walkRows.map((w) => [pairKey(w.from_postal, w.to_postal), w]));

  const missing: [string, string][] = [];
  for (let i = 0; i < allPostals.length; i++) {
    for (let j = i + 1; j < allPostals.length; j++) {
      const [a, b] = [allPostals[i], allPostals[j]].sort();
      if (!walks.has(pairKey(a, b))) missing.push([a, b]);
    }
  }
  if (missing.length) {
    const fetched = await mapLimit(missing, ONEMAP_PARALLEL, ([a, b]) => {
      oneMapCalls++;
      return walkRoute(coords.get(a)!, coords.get(b)!);
    });
    const rows: WalkRow[] = missing.map(([a, b], i) => ({ from_postal: a, to_postal: b, ...fetched[i] }));
    const { error } = await writer().from("walk_times").upsert(rows);
    if (error) throw error;
    for (const r of rows) walks.set(pairKey(r.from_postal, r.to_postal), r);
  }

  const walk = (a: Point, b: Point) => (a.postal === b.postal ? null : walks.get(pairKey(a.postal, b.postal))!);
  const cost = (i: number, j: number) => walk(points[i], points[j])?.seconds ?? 0;

  // 4. Best order, and block number order for comparison.
  const best = orderStops(stops.length, cost);
  const naive = stops
    .map((_, i) => i + 1)
    .sort((a, b) => compareBlockNumbers(points[a].blockNo, points[b].blockNo));
  const naiveSeconds = pathSeconds(naive, cost);

  const routeStops: RouteStop[] = best.order.map((idx, k) => {
    const from = k === 0 ? start : points[best.order[k - 1]];
    const to = points[idx];
    const w = walk(from, to);
    let legPath = w?.path ? decodePolyline(w.path) : [];
    if (w && w.from_postal !== from.postal) legPath = legPath.reverse();
    if (legPath.length < 2) legPath = [from, to].map(({ lat, lng }) => ({ lat, lng }));
    return {
      stopNo: k + 1,
      postalCode: to.postal,
      blockNo: to.blockNo,
      lat: to.lat,
      lng: to.lng,
      legSeconds: w?.seconds ?? 0,
      legMetres: w?.metres ?? 0,
      legPath,
    };
  });
  const totalMetres = routeStops.reduce((s, r) => s + r.legMetres, 0);

  // 5. Print the comparison in the server console.
  const min = (s: number) => `${Math.round(s / 60)} min`;
  console.log(
    `Route ${sessionId}: ${stops.length} stops, ${best.method}, optimised ${min(best.seconds)} vs block order ` +
      `${min(naiveSeconds)}, OneMap calls: ${oneMapCalls}` +
      (unmapped.length ? `, not on map: ${unmapped.map((u) => u.blockNo).join(", ")}` : ""),
  );

  return {
    ok: true,
    centre: { name: centre.name, postalCode: centre.postal_code, lat: centre.lat, lng: centre.lng },
    stops: routeStops,
    unmapped,
    totalSeconds: best.seconds,
    totalMetres,
    naiveSeconds,
    method: best.method,
  };
}

// Postal codes in walking order, then blocks that are not on the map. For the checklist.
export function routeOrder(plan: RoutePlan): string[] | undefined {
  if (!plan.ok) return undefined;
  return [...plan.stops.map((s) => s.postalCode), ...plan.unmapped.map((u) => u.postalCode)];
}
