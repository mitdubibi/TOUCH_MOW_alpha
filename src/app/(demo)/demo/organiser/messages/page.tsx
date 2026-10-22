"use client";

import { useState } from "react";
import { nowLabel, useDemo } from "@/components/demo/DemoProvider";
import { DemoHeader } from "@/components/demo/ui";
import { PROBLEM_LABEL, VOLUNTEERS } from "@/data/mockData";
import { unitById, unitLabel, volunteerById } from "@/lib/demo/model";

type Thread = "recipients" | "problems" | string;

export default function MessagesDemo() {
  const { state, dispatch } = useDemo();
  const [open, setOpen] = useState<Thread | null>(null);
  const [draft, setDraft] = useState("");
  const [calling, setCalling] = useState<string | null>(null);

  const inThread = (t: string) => state.messages.filter((m) => m.thread === t);

  if (!open) {
    const recipients = inThread("recipients");
    return (
      <>
        <DemoHeader title="Messages" subtitle="Volunteers, seniors and problem reports" />
        <main className="flex-1 divide-y divide-navy/10">
          <ThreadRow
            icon="🏠"
            title="From seniors"
            preview={recipients.at(-1) ? `${unitLabel(unitById(recipients.at(-1)!.unitId!))}: ${recipients.at(-1)!.body}` : "No messages"}
            count={recipients.length}
            onClick={() => setOpen("recipients")}
          />
          <ThreadRow
            icon="⚠️"
            title="Problem reports"
            preview={state.problems[0] ? `${PROBLEM_LABEL[state.problems[0].kind]} at ${unitLabel(unitById(state.problems[0].unitId))}` : "No problems reported"}
            count={state.problems.length}
            alert={state.problems.length > 0}
            onClick={() => setOpen("problems")}
          />
          {VOLUNTEERS.map((v) => {
            const last = inThread(v.id).at(-1);
            return (
              <ThreadRow
                key={v.id}
                icon={v.initials}
                colour={v.colour}
                title={v.name}
                preview={last ? `${last.from === "organiser" ? "You: " : ""}${last.body}` : "No messages yet"}
                onClick={() => setOpen(v.id)}
              />
            );
          })}
        </main>
      </>
    );
  }

  const title = open === "recipients" ? "From seniors" : open === "problems" ? "Problem reports" : volunteerById(open).name;

  return (
    <>
      <header className="sticky top-0 z-[1000] flex items-center gap-3 bg-navy px-4 py-4 text-white">
        <button type="button" onClick={() => setOpen(null)} className="font-medium text-sun">
          ‹ All
        </button>
        <h1 className="text-xl font-bold">{title}</h1>
      </header>

      <main className="flex-1 space-y-3 p-4">
        {open === "problems" &&
          (state.problems.length === 0 ? (
            <p className="text-slate-600">No problems reported.</p>
          ) : (
            state.problems.map((pr) => (
              <div key={pr.id} className="rounded-xl border-l-4 border-red-600 bg-red-50 p-3">
                <p className="font-semibold text-red-900">
                  {PROBLEM_LABEL[pr.kind]} · {unitLabel(unitById(pr.unitId))}
                </p>
                <p className="text-sm text-red-900/80">
                  {volunteerById(pr.volunteerId).name} · {pr.time}
                </p>
                {pr.note && <p className="mt-1 text-red-900">&ldquo;{pr.note}&rdquo;</p>}
              </div>
            ))
          ))}

        {open === "recipients" &&
          inThread("recipients").map((m) => (
            <div key={m.id} className="rounded-xl border border-navy/10 p-3">
              <p className="text-sm font-semibold text-navy/70">
                {unitLabel(unitById(m.unitId!))} · {m.time}
              </p>
              <p className="text-lg text-navy">{m.body}</p>
              <button
                type="button"
                onClick={() => setCalling(unitLabel(unitById(m.unitId!)))}
                className="mt-2 rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-sun"
              >
                📞 Call back
              </button>
            </div>
          ))}

        {open !== "recipients" &&
          open !== "problems" &&
          inThread(open).map((m) => (
            <div key={m.id} className={`flex ${m.from === "organiser" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  m.from === "organiser" ? "rounded-br-sm bg-navy text-white" : "rounded-bl-sm bg-sun-light text-navy"
                }`}
              >
                <p>{m.body}</p>
                <p className={`text-right text-xs ${m.from === "organiser" ? "text-white/60" : "text-navy/50"}`}>{m.time}</p>
              </div>
            </div>
          ))}
      </main>

      {open !== "recipients" && open !== "problems" && (
        <form
          className="sticky bottom-[57px] flex gap-2 border-t border-navy/10 bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            dispatch({ type: "send", message: { thread: open, from: "organiser", body: draft.trim(), time: nowLabel() } });
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${volunteerById(open).name}`}
            className="flex-1 rounded-full border border-slate-300 px-4 py-2"
          />
          <button className="rounded-full bg-sun px-4 font-bold text-navy">Send</button>
        </form>
      )}

      {calling && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-navy/95 p-6 text-center text-white">
          <div className="space-y-4">
            <p className="text-5xl">📞</p>
            <p className="text-2xl font-bold">Calling {calling}...</p>
            <p className="text-white/70">Demo only. No real call is made.</p>
            <button type="button" onClick={() => setCalling(null)} className="rounded-full bg-red-600 px-8 py-3 font-bold">
              End call
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ThreadRow({
  icon,
  colour,
  title,
  preview,
  count,
  alert,
  onClick,
}: {
  icon: string;
  colour?: string;
  title: string;
  preview: string;
  count?: number;
  alert?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-sun-light">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sun-light text-lg font-bold text-white"
        style={colour ? { background: colour } : undefined}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-navy">{title}</span>
        <span className="block truncate text-sm text-slate-600">{preview}</span>
      </span>
      {!!count && (
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${alert ? "bg-red-600 text-white" : "bg-sun text-navy"}`}>
          {count}
        </span>
      )}
    </button>
  );
}
