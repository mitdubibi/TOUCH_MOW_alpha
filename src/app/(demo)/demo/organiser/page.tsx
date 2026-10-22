"use client";

import Link from "next/link";
import { useState } from "react";
import { BugReports } from "@/components/demo/BugReports";
import { useDemo } from "@/components/demo/DemoProvider";
import { DemoHeader, ProgressBar } from "@/components/demo/ui";
import { CENTRE, PROBLEM_LABEL, SESSIONS, UNITS } from "@/data/mockData";
import { formatDate, todayInSingapore } from "@/lib/dates";
import { sessionWhen } from "@/lib/demo/format";
import { sessionProgress, unitById, unitLabel, volunteerById, volunteerPosition } from "@/lib/demo/model";

export default function OrganiserDashboard() {
  const { state, dispatch } = useDemo();
  const [resetting, setResetting] = useState(false);
  const today = SESSIONS.filter((s) => s.dayOffset === 0);
  const totals = today.map((s) => sessionProgress(state, s.id));
  const delivered = totals.reduce((n, p) => n + p.delivered, 0);
  const meals = totals.reduce((n, p) => n + p.total, 0);
  const recipientMsgs = state.messages.filter((m) => m.thread === "recipients").length;

  return (
    <>
      <DemoHeader title="Today" subtitle={`${formatDate(todayInSingapore())} · ${CENTRE.name}`} />
      <main className="flex-1 space-y-5 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat value={`${delivered}/${meals}`} label="Meals delivered" />
          <Stat value={String(state.problems.length)} label="Problems" alert={state.problems.length > 0} />
          <Stat value={String(recipientMsgs)} label="From seniors" />
        </div>

        {today.map((s) => {
          const when = sessionWhen(s);
          const p = sessionProgress(state, s.id);
          return (
            <section key={s.id} className="space-y-3 rounded-2xl border-2 border-navy/10 p-4 shadow-sm">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-bold text-navy">{when.title}</h2>
                <span className="text-sm text-slate-600">{s.team.length} volunteers</span>
              </div>
              <div>
                <p className="mb-1 text-3xl font-bold text-navy">
                  {p.delivered}/{p.total} <span className="text-base font-medium text-slate-600">delivered</span>
                </p>
                <ProgressBar value={p.delivered} total={p.total} />
                {p.done > p.delivered && (
                  <p className="mt-1 text-sm text-red-700">{p.done - p.delivered} not home</p>
                )}
              </div>
              <ul className="space-y-2">
                {s.team.map((vid) => {
                  const v = volunteerById(vid);
                  const vp = sessionProgress(state, s.id, vid);
                  return (
                    <li key={vid} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
                      <span className="flex items-center gap-2 font-medium text-navy">
                        <span className="h-3 w-3 rounded-full" style={{ background: v.colour }} />
                        {v.name}
                        <span className="text-xs font-normal text-slate-500">{volunteerPosition(state, s.id, vid).label}</span>
                      </span>
                      <span className="text-sm text-slate-600">
                        {vp.done}/{vp.total}
                      </span>
                      <div className="col-span-2">
                        <ProgressBar value={vp.done} total={vp.total} colour="bg-navy" />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="grid grid-cols-2 gap-2 text-center text-sm font-semibold">
                <Link href="/demo/organiser/assign" className="rounded-xl border-2 border-navy py-2 text-navy">
                  Assign blocks
                </Link>
                <Link href="/demo/organiser/map" className="rounded-xl bg-navy py-2 text-sun">
                  Live map
                </Link>
              </div>
            </section>
          );
        })}

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-navy">Problem reports</h2>
          {state.problems.length === 0 && <p className="text-slate-600">None yet. Volunteers report problems from their checklist.</p>}
          {state.problems.slice(0, 5).map((pr) => (
            <div key={pr.id} className="rounded-xl border-l-4 border-red-600 bg-red-50 p-3">
              <p className="font-semibold text-red-900">
                ⚠ {PROBLEM_LABEL[pr.kind]} · {unitLabel(unitById(pr.unitId))}
              </p>
              <p className="text-sm text-red-900/80">
                {volunteerById(pr.volunteerId).name} · {pr.time}
                {pr.note && ` · "${pr.note}"`}
              </p>
            </div>
          ))}
        </section>

        <RecipientLinks tokens={state.tokens} />

        <BugReports />

        <section className="space-y-2 rounded-2xl bg-navy/5 p-4">
          <h2 className="font-bold text-navy">Demo data</h2>
          <p className="text-sm text-slate-600">
            Puts every phone back to the start: ticks, assignments, locations, messages and problems. Elderly links stay
            the same.
          </p>
          <button
            type="button"
            disabled={resetting}
            onClick={() => {
              if (!confirm("Reset the demo for everyone?")) return;
              setResetting(true);
              dispatch({ type: "reset" });
              setTimeout(() => setResetting(false), 2000);
            }}
            className="w-full rounded-xl border-2 border-red-700 py-3 font-bold text-red-800 disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset demo data"}
          </button>
        </section>
      </main>
    </>
  );
}

function Stat({ value, label, alert }: { value: string; label: string; alert?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${alert ? "bg-red-600 text-white" : "bg-navy text-white"}`}>
      <p className={`text-2xl font-bold ${alert ? "" : "text-sun"}`}>{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  );
}

// Each household's private link (random token, no login). Organisers would send these by SMS.
function RecipientLinks({ tokens }: { tokens: Record<string, string> }) {
  const [copied, setCopied] = useState<string | null>(null);
  const today = UNITS.filter((u) => SESSIONS.some((s) => s.dayOffset === 0 && s.unitIds.includes(u.id)) && tokens[u.id]);
  const url = (token: string) => `${window.location.origin}/demo/elderly/${token}`;

  return (
    <details className="rounded-2xl border-2 border-navy/10 p-4">
      <summary className="cursor-pointer text-lg font-bold text-navy">Elderly links ({today.length})</summary>
      <p className="mt-2 text-sm text-slate-600">Each household has its own private link with no login. Open one in another window to watch its ETA.</p>
      <ul className="mt-3 divide-y divide-navy/10">
        {today.map((u) => (
          <li key={u.id} className="flex items-center gap-2 py-2">
            <a href={`/demo/elderly/${tokens[u.id]}`} target="_blank" rel="noreferrer" className="flex-1 font-medium text-navy underline">
              {unitLabel(u)}
            </a>
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard?.writeText(url(tokens[u.id])).then(() => setCopied(u.id), () => setCopied(null))
              }
              className="rounded-lg border border-navy/20 px-2 py-1 text-xs font-semibold text-navy"
            >
              {copied === u.id ? "Copied" : "Copy link"}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
