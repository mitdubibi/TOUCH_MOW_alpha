"use client";

import { useParams } from "next/navigation";
import { CENTRE_PIN, DemoMap, type MapPin } from "@/components/demo/DemoMap";
import { useDemo } from "@/components/demo/DemoProvider";
import { DemoHeader, Tabs } from "@/components/demo/ui";
import { CENTRE } from "@/data/mockData";
import { isDone } from "@/lib/checklist";
import { sessionWhen } from "@/lib/demo/format";
import { routeFor, sessionById, statusOf, volunteerById, volunteerPosition } from "@/lib/demo/model";
import { metresBetween, walkMinutes } from "@/lib/demo/route";

export default function VolunteerRouteMap() {
  const { id } = useParams<{ id: string }>();
  const { state } = useDemo();
  const session = sessionById(id);
  if (!session) return <DemoHeader title="Session not found" back="/demo/volunteer" />;

  const when = sessionWhen(session);
  const route = routeFor(state, id, state.volunteerId);
  const stopDone = (units: { id: string }[]) => units.every((u) => isDone(statusOf(state, id, u.id)));

  const pins: MapPin[] = [
    CENTRE_PIN,
    ...route.map<MapPin>((s) => ({
      id: s.block.postal,
      lat: s.block.lat,
      lng: s.block.lng,
      label: stopDone(s.units) ? "✓" : String(s.stopNo),
      variant: stopDone(s.units) ? "done" : "stop",
      title: `Stop ${s.stopNo}: Blk ${s.block.blockNo} (${s.units.length} meals)`,
    })),
  ];
  // Where you are now, while sharing a location or simulating the walk.
  const here = volunteerPosition(state, id, state.volunteerId);
  if (here.live) {
    const me = volunteerById(state.volunteerId);
    pins.push({ id: "me", lat: here.at.lat, lng: here.at.lng, label: me.initials, variant: "volunteer", colour: me.colour, title: "You" });
  }
  const path = [CENTRE, ...route.map((s) => s.block)];
  const legs = route.map((s, i) => {
    const from = i === 0 ? CENTRE : route[i - 1].block;
    return { minutes: walkMinutes(from, s.block), metres: metresBetween(from, s.block) };
  });
  const totalMin = legs.reduce((sum, l) => sum + l.minutes, 0);
  const totalM = legs.reduce((sum, l) => sum + l.metres, 0);

  return (
    <>
      <DemoHeader title={when.title} subtitle={`${when.day} · your route`} back="/demo/volunteer" />
      <div className="border-b border-navy/10 px-4 py-3">
        <Tabs
          items={[
            { href: `/demo/volunteer/session/${id}`, label: "Checklist" },
            { href: `/demo/volunteer/session/${id}/map`, label: "Route" },
          ]}
        />
      </div>
      <main className="flex-1 space-y-4 p-4">
        {route.length === 0 ? (
          <p className="text-slate-600">No blocks assigned to you yet.</p>
        ) : (
          <>
            <DemoMap pins={pins} path={path} />
            <ol className="space-y-2">
              <li className="flex items-center gap-3 rounded-xl bg-sun-light px-3 py-2">
                <span className="rounded-md bg-sun px-2 py-1 text-xs font-bold text-navy">Start</span>
                <span className="font-semibold text-navy">{CENTRE.name}</span>
              </li>
              {route.map((s, i) => {
                const min = legs[i].minutes;
                const done = stopDone(s.units);
                return (
                  <li key={s.block.postal} className="flex items-center gap-3 rounded-xl border border-navy/10 px-3 py-2">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold ${
                        done ? "bg-slate-400 text-white" : "bg-navy text-sun"
                      }`}
                    >
                      {done ? "✓" : s.stopNo}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-navy">Blk {s.block.blockNo}</p>
                      <p className="text-sm text-slate-600">
                        {s.units.length} meals · levels {s.units.map((u) => u.floor).join(", ")}
                      </p>
                    </div>
                    <span className="text-sm text-slate-600">{Math.max(1, Math.round(min))} min walk</span>
                  </li>
                );
              })}
            </ol>
            <p className="text-center text-sm text-slate-600">
              About {Math.round(totalMin)} min walking, {(totalM / 1000).toFixed(1)} km one way
            </p>
          </>
        )}
      </main>
    </>
  );
}
