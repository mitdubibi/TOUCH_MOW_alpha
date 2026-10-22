import { isDone } from "@/lib/checklist";
import type { RoutePlan } from "@/lib/route/plan";
import type { ChecklistItem } from "@/types/db";
import { LiveRouteMap } from "@/components/map/LiveRouteMap";
import { RouteMap, type RouteMapStop, type RouteMapVolunteer } from "@/components/map/RouteMap";

const minutes = (s: number) => Math.round(s / 60);
const legMinutes = (s: number) => (s === 0 ? "Same block" : `${Math.max(1, minutes(s))} min walk`);

// Optimised walking time next to the time for the same blocks in block number order.
export function RouteSummary({ plan }: { plan: RoutePlan }) {
  if (!plan.ok) {
    return (
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Route not planned yet, so blocks are in number order. ({plan.error})
      </p>
    );
  }
  if (!plan.stops.length) return null;

  const saved = minutes(plan.naiveSeconds) - minutes(plan.totalSeconds);
  return (
    <div className="space-y-1 rounded-xl bg-sun-light px-4 py-3 text-navy">
      <p className="text-lg font-bold">About {minutes(plan.totalSeconds)} min walking</p>
      <p className="text-sm">
        Block number order: {minutes(plan.naiveSeconds)} min.{" "}
        {saved > 0 ? `This route saves ${saved} min.` : "This route is the same or close."}
      </p>
      <p className="text-xs text-slate-700">
        {plan.stops.length} {plan.stops.length === 1 ? "stop" : "stops"}, {(plan.totalMetres / 1000).toFixed(1)} km one
        way, {plan.method === "brute force" ? "best of every order" : "nearest neighbour + 2-opt"}. Walking times
        from OneMap.
      </p>
      {plan.unmapped.length > 0 && (
        <p className="text-sm font-medium text-red-800">
          Not found on the map: {plan.unmapped.map((u) => `Blk ${u.blockNo}`).join(", ")}. Listed last.
        </p>
      )}
    </div>
  );
}

// Map with numbered pins and the walking path, then the stops in order.
// With `live`, volunteers who are sharing their location move on the map (organiser view).
export function RouteDetails({
  plan,
  items,
  live,
  photos = {},
}: {
  plan: RoutePlan;
  items: ChecklistItem[];
  live?: { sessionId: string; volunteers: RouteMapVolunteer[]; names: Record<string, string> };
  // postal code -> photo of the block.
  photos?: Record<string, string>;
}) {
  if (!plan.ok || !plan.stops.length) return null;

  const active = items.filter((i) => i.status !== "cancelled");
  const unitsIn = (postal: string) => active.filter((i) => i.postal_code === postal);
  const stops: RouteMapStop[] = plan.stops.map((s) => {
    const units = unitsIn(s.postalCode);
    return {
      lat: s.lat,
      lng: s.lng,
      stopNo: s.stopNo,
      blockNo: s.blockNo,
      units: units.length,
      done: units.length > 0 && units.every((u) => isDone(u.status)),
    };
  });
  const path = plan.stops.flatMap((s) => s.legPath);

  return (
    <div className="space-y-3">
      {live ? (
        <LiveRouteMap
          centre={plan.centre}
          stops={stops}
          path={path}
          sessionId={live.sessionId}
          initialVolunteers={live.volunteers}
          names={live.names}
        />
      ) : (
        <RouteMap centre={plan.centre} stops={stops} path={path} />
      )}
      <ol className="space-y-2">
        <li className="flex items-center gap-3 rounded-xl bg-sun-light px-3 py-2">
          <span className="rounded-md bg-sun px-2 py-1 text-xs font-bold text-navy">Start</span>
          <span className="font-semibold text-navy">{plan.centre.name}</span>
        </li>
        {plan.stops.map((s, i) => {
          const done = stops[i].done;
          return (
            <li key={s.postalCode} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold ${
                  done ? "bg-slate-400 text-white" : "bg-navy text-sun"
                }`}
              >
                {done ? "✓" : s.stopNo}
              </span>
              {photos[s.postalCode] && (
                <a href={photos[s.postalCode]} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photos[s.postalCode]}
                    alt={`Blk ${s.blockNo}`}
                    loading="lazy"
                    className="h-14 w-14 rounded-lg object-cover"
                  />
                </a>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Blk {s.blockNo}</p>
                <p className="text-sm text-slate-600">
                  {stops[i].units} {stops[i].units === 1 ? "meal" : "meals"}
                </p>
              </div>
              <span className="text-sm text-slate-600">{legMinutes(s.legSeconds)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
