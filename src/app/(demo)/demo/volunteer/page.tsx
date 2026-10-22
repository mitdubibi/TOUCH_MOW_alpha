"use client";

import Link from "next/link";
import { useDemo } from "@/components/demo/DemoProvider";
import { DemoHeader, ProgressBar } from "@/components/demo/ui";
import { CENTRE, SESSIONS, VOLUNTEERS } from "@/data/mockData";
import { sessionWhen } from "@/lib/demo/format";
import { routeFor, sessionProgress, volunteerById } from "@/lib/demo/model";

export default function VolunteerHome() {
  const { state, dispatch } = useDemo();
  const me = volunteerById(state.volunteerId);
  const mySessions = SESSIONS.filter((s) => s.team.includes(me.id));
  const latest = [...state.messages].reverse().find((m) => m.thread === me.id && m.from === "organiser");

  return (
    <>
      <DemoHeader title="My sessions" subtitle={`Hello, ${me.name}`} />
      <main className="flex-1 space-y-4 p-4">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Demo: viewing as
          <select
            value={me.id}
            onChange={(e) => dispatch({ type: "setVolunteer", volunteerId: e.target.value })}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 font-medium text-navy"
          >
            {VOLUNTEERS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>

        <Link href="/demo/volunteer/messages" className="block rounded-2xl border-l-8 border-sun bg-sun-light p-4">
          {latest ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/70">Message from TOUCH · {latest.time}</p>
              <p className="mt-1 text-navy">{latest.body}</p>
            </>
          ) : (
            <p className="text-navy">No messages from TOUCH yet.</p>
          )}
          <p className="mt-2 text-sm font-semibold text-navy underline">💬 Open messages and reply</p>
        </Link>

        {mySessions.length === 0 && <p className="text-slate-600">No sessions yet. TOUCH will add you to one.</p>}

        {mySessions.map((s) => {
          const when = sessionWhen(s);
          const p = sessionProgress(state, s.id, me.id);
          const stops = routeFor(state, s.id, me.id).length;
          return (
            <Link
              key={s.id}
              href={`/demo/volunteer/session/${s.id}`}
              className="block rounded-2xl border-2 border-navy/10 p-4 shadow-sm active:bg-sun-light"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-navy/60">
                    {when.day} · {when.date}
                  </p>
                  <p className="text-2xl font-bold text-navy">{when.title}</p>
                </div>
                {s.dayOffset === 0 && (
                  <span className="rounded-full bg-sun px-3 py-1 text-xs font-bold text-navy">TODAY</span>
                )}
              </div>
              <p className="mt-2 text-slate-700">
                📍 Collect at <strong>{CENTRE.name}</strong>, {CENTRE.address}
              </p>
              <p className="text-slate-700">
                🍱 {p.total} meals · {stops} stops
              </p>
              <div className="mt-3 space-y-1">
                <ProgressBar value={p.done} total={p.total} />
                <p className="text-sm text-slate-600">
                  {p.done} of {p.total} done
                </p>
              </div>
            </Link>
          );
        })}
      </main>
    </>
  );
}
