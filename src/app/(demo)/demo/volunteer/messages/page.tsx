"use client";

import { useEffect, useRef, useState } from "react";
import { nowLabel, useDemo } from "@/components/demo/DemoProvider";
import { DemoHeader } from "@/components/demo/ui";
import { volunteerById } from "@/lib/demo/model";

// The volunteer's side of their thread with the organiser. New messages arrive live.
export default function VolunteerMessages() {
  const { state, dispatch } = useDemo();
  const me = volunteerById(state.volunteerId);
  const thread = state.messages.filter((m) => m.thread === me.id);
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [thread.length]);

  return (
    <>
      <DemoHeader title="Messages" subtitle={`${me.name} and TOUCH`} back="/demo/volunteer" />
      <main className="flex-1 space-y-3 p-4">
        {thread.length === 0 && <p className="text-slate-600">No messages yet.</p>}
        {thread.map((m) => (
          <div key={m.id} className={`flex ${m.from === "volunteer" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                m.from === "volunteer" ? "rounded-br-sm bg-navy text-white" : "rounded-bl-sm bg-sun-light text-navy"
              }`}
            >
              {m.from === "organiser" && <p className="text-xs font-bold">TOUCH</p>}
              <p>{m.body}</p>
              <p className={`text-right text-xs ${m.from === "volunteer" ? "text-white/60" : "text-navy/50"}`}>{m.time}</p>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </main>
      <form
        className="sticky bottom-0 flex gap-2 border-t border-navy/10 bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          dispatch({ type: "send", message: { thread: me.id, from: "volunteer", body: draft.trim(), time: nowLabel() } });
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={1000}
          placeholder="Message TOUCH"
          aria-label="Message TOUCH"
          className="flex-1 rounded-full border border-slate-300 px-4 py-2"
        />
        <button className="rounded-full bg-sun px-4 font-bold text-navy">Send</button>
      </form>
    </>
  );
}
