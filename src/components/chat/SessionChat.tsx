"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatClock, formatDate } from "@/lib/dates";
import { MESSAGE_SELECT } from "@/lib/messages";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/types/db";

type Props = {
  sessionId: string;
  meId: string;
  initialMessages: ChatMessage[];
};

const MAX_LENGTH = 1000;

// Singapore date of a message, for the day dividers.
const sgDate = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600_000).toISOString().slice(0, 10);

export function SessionChat({ sessionId, meId, initialMessages }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const add = (m: ChatMessage) => setMessages((prev) => (prev.some((p) => p.id === m.id) ? prev : [...prev, m]));

  // New messages from the organiser and the rest of the team.
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `session_id=eq.${sessionId}` },
        (payload) => add(payload.new as ChatMessage),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, sessionId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: { preventDefault(): void }) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const { data, error: dbError } = await supabase
      .from("messages")
      .insert({ thread_type: "team", session_id: sessionId, sender_id: meId, body })
      .select(MESSAGE_SELECT)
      .single<ChatMessage>();
    setSending(false);
    if (dbError) {
      setError(
        !navigator.onLine || /fetch|network/i.test(dbError.message)
          ? "Not sent. No signal, try again in a moment."
          : `Not sent: ${dbError.message}`,
      );
      return;
    }
    setDraft("");
    add(data);
  }

  return (
    <div className="flex flex-col gap-3">
      <ol className="space-y-3" aria-live="polite">
        {messages.length === 0 && (
          <li className="text-slate-600">No messages yet. Questions about this session go here.</li>
        )}
        {messages.map((m, i) => {
          const mine = m.sender_id === meId;
          const newDay = i === 0 || sgDate(m.created_at) !== sgDate(messages[i - 1].created_at);
          return (
            <li key={m.id}>
              {newDay && (
                <p className="my-2 text-center text-xs font-semibold text-slate-500">{formatDate(sgDate(m.created_at))}</p>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                    mine ? "rounded-br-sm bg-navy text-white" : "rounded-bl-sm bg-sun-light text-navy"
                  }`}
                >
                  {!mine && (
                    <p className="text-sm font-semibold">
                      {m.sender_name}
                      {m.sender_is_organiser && (
                        <span className="ml-2 rounded bg-navy px-1.5 py-0.5 text-xs text-sun">TOUCH</span>
                      )}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-lg">{m.body}</p>
                  <p className={`text-right text-xs ${mine ? "text-white/70" : "text-navy/60"}`}>
                    {formatClock(m.created_at)}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={bottom} />

      <form onSubmit={send} className="sticky bottom-0 -mx-4 space-y-1 border-t border-slate-200 bg-white px-4 py-3">
        <div className="flex gap-2">
          <label htmlFor="chat-draft" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter is a new line. Not while typing Chinese with an input method.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) void send(e);
            }}
            maxLength={MAX_LENGTH}
            rows={1}
            placeholder="Message the team"
            className="min-w-0 flex-1 resize-none rounded-2xl border border-slate-400 px-4 py-2 text-lg"
          />
          <button
            disabled={sending || !draft.trim()}
            className="shrink-0 rounded-2xl bg-teal-700 px-4 font-semibold text-white disabled:opacity-50"
          >
            {sending ? "..." : "Send"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
