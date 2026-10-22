"use client";

import { useState } from "react";
import { CENTRE_PIN, DemoMap, type MapPin } from "@/components/demo/DemoMap";
import { useDemo } from "@/components/demo/DemoProvider";
import { DemoHeader, ProgressBar } from "@/components/demo/ui";
import { SESSIONS } from "@/data/mockData";
import { isDone } from "@/lib/checklist";
import { sessionWhen } from "@/lib/demo/format";
import {
  blockByPostal,
  sessionProgress,
  statusOf,
  unitById,
  volunteerById,
  volunteerPosition,
} from "@/lib/demo/model";

export default function LiveMapDemo() {
  const { state } = useDemo();
  const today = SESSIONS.filter((s) => s.dayOffset === 0);
  const [sessionId, setSessionId] = useState(today[0].id);
  const session = today.find((s) => s.id === sessionId)!;
  const assigned = state.assignments[sessionId] ?? {};

  const postals = [...new Set(session.unitIds.map((id) => unitById(id).postal))];
  const blockPins = postals.map<MapPin>((postal) => {
    const b = blockByPostal(postal);
    const units = session.unitIds.filter((id) => unitById(id).postal === postal);
    const done = units.every((id) => isDone(statusOf(state, sessionId, id)));
    const vid = assigned[postal];
    return {
      id: postal,
      lat: b.lat,
      lng: b.lng,
      label: done ? "✓" : b.blockNo,
      variant: done ? "done" : "block",
      colour: vid ? volunteerById(vid).colour : undefined,
      title: `Blk ${b.blockNo}: ${units.filter((id) => isDone(statusOf(state, sessionId, id))).length}/${units.length} done`,
    };
  });
  // Live pins sit where the phone is. Without a shared position a pin waits at the last ticked block,
  // nudged a little so two volunteers at the same block are both visible.
  const volunteerPins = session.team.map<MapPin>((vid, i) => {
    const v = volunteerById(vid);
    const pos = volunteerPosition(state, sessionId, vid);
    return {
      id: vid,
      lat: pos.live ? pos.at.lat : pos.at.lat + 0.00018 * (i + 1),
      lng: pos.live ? pos.at.lng : pos.at.lng + 0.00012 * i,
      label: v.initials,
      variant: "volunteer",
      colour: v.colour,
      title: `${v.name}: ${pos.label}`,
    };
  });

  return (
    <>
      <DemoHeader title="Live map" subtitle="Where volunteers are now" />
      <main className="flex-1 space-y-4 p-4">
        <div className="flex gap-2">
          {today.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSessionId(s.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                s.id === sessionId ? "bg-navy text-sun" : "bg-navy/5 text-navy"
              }`}
            >
              {sessionWhen(s).title}
            </button>
          ))}
        </div>

        <DemoMap
          pins={[CENTRE_PIN, ...blockPins, ...volunteerPins]}
        />

        <ul className="space-y-2">
          {session.team.map((vid) => {
            const v = volunteerById(vid);
            const p = sessionProgress(state, sessionId, vid);
            return (
              <li key={vid} className="space-y-2 rounded-xl border border-navy/10 p-3">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: v.colour }}
                  >
                    {v.initials}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-navy">{v.name}</p>
                    <p className="text-sm text-slate-600">
                      {volunteerPosition(state, sessionId, vid).label} · {p.done}/{p.total} done
                    </p>
                  </div>
                </div>
                <ProgressBar value={p.done} total={p.total} colour="bg-navy" />
              </li>
            );
          })}
        </ul>
        <p className="text-center text-xs text-slate-500">
          Pins move with each volunteer&apos;s shared location (Start delivery or Simulate walking). Without one, a pin waits at the last block they ticked.
        </p>
      </main>
    </>
  );
}
