"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { nowLabel, useDemo } from "@/components/demo/DemoProvider";
import { TrackingControls } from "@/components/demo/TrackingControls";
import { DemoHeader, ProgressBar, Tabs } from "@/components/demo/ui";
import { CENTRE, PROBLEM_LABEL, type DemoUnit } from "@/data/mockData";
import { isDone } from "@/lib/checklist";
import { sessionWhen } from "@/lib/demo/format";
import { routeFor, sessionById, sessionProgress, statusOf, unitLabel, type ProblemKind } from "@/lib/demo/model";

const STATUS_TEXT = { pending: "", delivered: "Delivered", not_home: "Not home", skipped: "Skipped", cancelled: "Removed" };

export default function VolunteerSession() {
  const { id } = useParams<{ id: string }>();
  const { state, dispatch } = useDemo();
  const [reporting, setReporting] = useState<DemoUnit | null>(null);

  const session = sessionById(id);
  if (!session) return <DemoHeader title="Session not found" back="/demo/volunteer" />;

  const when = sessionWhen(session);
  const route = routeFor(state, id, state.volunteerId);
  const p = sessionProgress(state, id, state.volunteerId);

  return (
    <>
      <DemoHeader title={when.title} subtitle={`${when.day} · collect at ${CENTRE.name}`} back="/demo/volunteer" />
      <div className="space-y-3 border-b border-navy/10 bg-white px-4 py-3">
        <Tabs
          items={[
            { href: `/demo/volunteer/session/${id}`, label: "Checklist" },
            { href: `/demo/volunteer/session/${id}/map`, label: "Route" },
          ]}
        />
        <div>
          <div className="mb-1 flex justify-between text-sm font-semibold text-navy">
            <span>
              {p.done} of {p.total} done
            </span>
            <span>{route.length} stops</span>
          </div>
          <ProgressBar value={p.done} total={p.total} />
        </div>
        {session.dayOffset === 0 && route.length > 0 && <TrackingControls sessionId={id} />}
      </div>

      <main className="flex-1 space-y-4 p-4">
        {route.length === 0 && <p className="text-slate-600">No blocks assigned to you yet.</p>}
        {route.map((stop) => {
          const top = stop.units[0]?.floor;
          return (
            <section key={stop.block.postal} className="overflow-hidden rounded-2xl border-2 border-navy/10">
              <header className="flex items-center gap-3 bg-navy px-4 py-2 text-white">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sun text-lg font-bold text-navy">
                  {stop.stopNo}
                </span>
                <div>
                  <h2 className="text-xl font-bold">Blk {stop.block.blockNo}</h2>
                  <p className="text-xs text-white/75">
                    {stop.block.street} · lift to level {top}, then walk down
                  </p>
                </div>
              </header>
              <ul className="divide-y divide-navy/10">
                {stop.units.map((u) => {
                  const status = statusOf(state, id, u.id);
                  const done = isDone(status);
                  const problem = state.problems.find((pr) => pr.sessionId === id && pr.unitId === u.id);
                  return (
                    <li key={u.id} className={`flex items-center gap-3 px-4 py-3 ${done ? "bg-slate-50" : ""}`}>
                      <div className="min-w-0 flex-1">
                        <p className={`text-2xl font-bold ${done ? "text-slate-400" : "text-navy"}`}>{u.unitNo}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm">
                          <span className="rounded bg-sun-light px-1.5 font-semibold text-navy">{u.mealType}</span>
                          {STATUS_TEXT[status] && <span className="font-medium text-slate-600">{STATUS_TEXT[status]}</span>}
                        </p>
                        {u.remarks && <p className="mt-1 text-sm text-slate-600">{u.remarks}</p>}
                        {problem && (
                          <p className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                            ⚠ {PROBLEM_LABEL[problem.kind]} reported
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={() => setReporting(u)}
                          className="mt-1 block text-sm font-medium text-navy underline underline-offset-2"
                        >
                          Report a problem
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-pressed={status === "delivered"}
                        aria-label={status === "delivered" ? `Undo ${u.unitNo}` : `Mark ${u.unitNo} delivered`}
                        onClick={() =>
                          dispatch({
                            type: "setStatus",
                            sessionId: id,
                            unitId: u.id,
                            status: status === "delivered" ? "pending" : "delivered",
                          })
                        }
                        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-[3px] text-4xl font-black transition-colors ${
                          status === "delivered" ? "border-navy bg-sun text-navy" : "border-navy/25 bg-white text-navy/15"
                        }`}
                      >
                        ✓
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>

      {reporting && (
        <ReportSheet
          unit={reporting}
          onClose={() => setReporting(null)}
          onSend={(kind, note) => {
            dispatch({
              type: "report",
              sessionId: id,
              unitId: reporting.id,
              volunteerId: state.volunteerId,
              kind,
              note,
              time: nowLabel(),
            });
            setReporting(null);
          }}
        />
      )}
    </>
  );
}

function ReportSheet({
  unit,
  onClose,
  onSend,
}: {
  unit: DemoUnit;
  onClose: () => void;
  onSend: (kind: ProblemKind, note: string) => void;
}) {
  const [kind, setKind] = useState<ProblemKind | null>(null);
  const [note, setNote] = useState("");
  return (
    <div className="fixed inset-0 z-[2000] flex items-end bg-navy/60" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Report a problem"
        className="mx-auto w-full max-w-[420px] space-y-4 rounded-t-3xl bg-white p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-xl font-bold text-navy">Report a problem</h2>
          <p className="text-slate-600">{unitLabel(unit)}</p>
        </div>
        <div className="space-y-2">
          {(Object.keys(PROBLEM_LABEL) as ProblemKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`w-full rounded-xl border-2 px-4 py-3 text-left text-lg font-semibold ${
                kind === k ? "border-navy bg-sun text-navy" : "border-navy/15 text-navy"
              }`}
            >
              {PROBLEM_LABEL[k]}
              {k === "no_answer" && <span className="block text-sm font-normal">Also marks the unit as Not home</span>}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (optional)"
          rows={2}
          className="w-full rounded-xl border border-slate-300 p-3"
        />
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border-2 border-navy/20 py-3 font-semibold text-navy">
            Cancel
          </button>
          <button
            type="button"
            disabled={!kind}
            onClick={() => kind && onSend(kind, note.trim())}
            className="rounded-xl bg-navy py-3 font-semibold text-sun disabled:opacity-40"
          >
            Send to TOUCH
          </button>
        </div>
      </div>
    </div>
  );
}
