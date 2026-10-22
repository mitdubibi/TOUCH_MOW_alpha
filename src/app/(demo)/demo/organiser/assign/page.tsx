"use client";

import { useState } from "react";
import { CENTRE_PIN, DemoMap, type MapPin } from "@/components/demo/DemoMap";
import { useDemo } from "@/components/demo/DemoProvider";
import { DemoHeader } from "@/components/demo/ui";
import { SESSIONS } from "@/data/mockData";
import { sessionWhen } from "@/lib/demo/format";
import { blockByPostal, sessionProgress, unitById, volunteerById } from "@/lib/demo/model";

export default function AssignDemo() {
  const { state, dispatch } = useDemo();
  const [sessionId, setSessionId] = useState(SESSIONS[0].id);
  const session = SESSIONS.find((s) => s.id === sessionId)!;
  const assigned = state.assignments[sessionId] ?? {};

  const unitsPerBlock = new Map<string, number>();
  for (const id of session.unitIds) {
    const postal = unitById(id).postal;
    unitsPerBlock.set(postal, (unitsPerBlock.get(postal) ?? 0) + 1);
  }
  const blocks = [...unitsPerBlock.keys()].map(blockByPostal).sort((a, b) => a.blockNo.localeCompare(b.blockNo));

  const pins: MapPin[] = [
    CENTRE_PIN,
    ...blocks.map<MapPin>((b) => ({
      id: b.postal,
      lat: b.lat,
      lng: b.lng,
      label: b.blockNo,
      variant: "block",
      colour: assigned[b.postal] ? volunteerById(assigned[b.postal]).colour : undefined,
      title: `Blk ${b.blockNo}: ${unitsPerBlock.get(b.postal)} meals`,
    })),
  ];

  return (
    <>
      <DemoHeader title="Assign blocks" subtitle="Each block goes to one volunteer" />
      <main className="flex-1 space-y-4 p-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {SESSIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSessionId(s.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                s.id === sessionId ? "bg-navy text-sun" : "bg-navy/5 text-navy"
              }`}
            >
              {sessionWhen(s).short}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {session.team.map((vid) => {
            const v = volunteerById(vid);
            const p = sessionProgress(state, sessionId, vid);
            const nBlocks = blocks.filter((b) => assigned[b.postal] === vid).length;
            return (
              <div key={vid} className="rounded-xl border-2 p-2" style={{ borderColor: v.colour }}>
                <p className="font-bold text-navy">{v.name}</p>
                <p className="text-sm text-slate-600">
                  {p.total} meals · {nBlocks} blocks
                </p>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => dispatch({ type: "autoSplit", sessionId })}
          className="w-full rounded-xl bg-sun py-3 text-lg font-bold text-navy"
        >
          ⚡ Auto split by block
        </button>

        <DemoMap pins={pins} height={240} />

        <ul className="space-y-2">
          {blocks.map((b) => {
            const vid = assigned[b.postal];
            return (
              <li key={b.postal} className="flex items-center gap-3 rounded-xl border border-navy/10 p-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: vid ? volunteerById(vid).colour : "#64748b" }}
                >
                  {b.blockNo}
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-navy">Blk {b.blockNo}</p>
                  <p className="text-sm text-slate-600">{unitsPerBlock.get(b.postal)} meals</p>
                </div>
                <select
                  value={vid ?? ""}
                  onChange={(e) => dispatch({ type: "assign", sessionId, postal: b.postal, volunteerId: e.target.value })}
                  aria-label={`Volunteer for Blk ${b.blockNo}`}
                  className="rounded-lg border-2 border-navy/20 bg-white px-2 py-2 font-medium text-navy"
                >
                  {!vid && <option value="">Choose</option>}
                  {session.team.map((t) => (
                    <option key={t} value={t}>
                      {volunteerById(t).name}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
