"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PROBLEM_KINDS, PROBLEM_LABEL } from "@/lib/problems";
import type { ChecklistItem, ProblemKind } from "@/types/db";

type Props = {
  supabase: SupabaseClient;
  item: ChecklistItem;
  onPatch: (id: string, patch: Partial<ChecklistItem>) => void;
};

// Red tags for problems already reported on a unit. Shown to volunteers and organisers.
export function ProblemBadges({ item }: { item: ChecklistItem }) {
  const kinds = [...new Set(item.problems.map((p) => p.kind))];
  if (!kinds.length) return null;
  return (
    <p className="mt-1 flex flex-wrap gap-1">
      {kinds.map((k) => (
        <span key={k} className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
          ⚠ {PROBLEM_LABEL[k]} reported
        </span>
      ))}
    </p>
  );
}

// Volunteer: "Report a problem" under a unit, opening a sheet like the /demo prototype.
export function ReportProblem({ supabase, item, onPatch }: Props) {
  const [open, setOpen] = useState(false);

  if (item.status === "cancelled") return null;

  return (
    <>
      <ProblemBadges item={item} />
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 block text-sm font-medium text-navy underline underline-offset-2"
      >
        Report a problem
      </button>
      {open && <ReportSheet supabase={supabase} item={item} onPatch={onPatch} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReportSheet({ supabase, item, onPatch, onClose }: Props & { onClose: () => void }) {
  const [kind, setKind] = useState<ProblemKind | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!kind) return;
    setSending(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("report_problem", {
      p_delivery_id: item.id,
      p_kind: kind,
      p_note: note.trim() || null,
    });
    setSending(false);
    if (rpcError) {
      setError(
        !navigator.onLine || /fetch|network/i.test(rpcError.message)
          ? "No signal. Try again when you have signal."
          : `Not sent: ${rpcError.message}`,
      );
      return;
    }
    const markedNotHome = kind === "no_answer" && item.status === "pending";
    onPatch(item.id, {
      problems: [...item.problems, { kind, created_at: (data as { created_at: string }).created_at }],
      ...(markedNotHome ? { status: "not_home", done_at: new Date().toISOString() } : {}),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[2000] flex items-end bg-navy/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Report a problem"
        className="mx-auto w-full max-w-[420px] space-y-4 rounded-t-3xl bg-white p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-xl font-bold text-navy">Report a problem</h2>
          <p className="text-slate-600">
            Blk {item.block_no} {item.unit_no}
          </p>
        </div>
        <div className="space-y-2">
          {PROBLEM_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => setKind(k)}
              className={`w-full rounded-xl border-2 px-4 py-3 text-left text-lg font-semibold ${
                kind === k ? "border-navy bg-sun text-navy" : "border-navy/15 text-navy"
              }`}
            >
              {PROBLEM_LABEL[k]}
              {k === "no_answer" && item.status === "pending" && (
                <span className="block text-sm font-normal">Also marks the unit as Not home</span>
              )}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="sr-only">Note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Add a note (optional). No names or phone numbers."
            rows={2}
            className="w-full rounded-xl border border-slate-300 p-3"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border-2 border-navy/20 py-3 font-semibold text-navy">
            Cancel
          </button>
          <button
            type="button"
            disabled={!kind || sending}
            onClick={send}
            className="rounded-xl bg-navy py-3 font-semibold text-sun disabled:opacity-40"
          >
            {sending ? "Sending..." : "Send to TOUCH"}
          </button>
        </div>
      </div>
    </div>
  );
}
