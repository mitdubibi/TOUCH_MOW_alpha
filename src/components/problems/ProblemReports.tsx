"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatClock } from "@/lib/dates";
import { fetchProblemReports, PROBLEM_LABEL, type ProblemReport } from "@/lib/problems";
import { createClient } from "@/lib/supabase/client";

type Props = {
  sessionId: string;
  organiserId: string;
  initialReports: ProblemReport[];
};

// Organiser: problems volunteers reported in this session, live. Open ones first.
export function ProblemReports({ sessionId, organiserId, initialReports }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [reports, setReports] = useState(initialReports);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setReports(await fetchProblemReports(supabase, sessionId));
    } catch {
      // Offline; keep what we have.
    }
  }, [supabase, sessionId]);

  useEffect(() => {
    const channel = supabase
      .channel(`problems:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "problem_reports", filter: `session_id=eq.${sessionId}` },
        () => void refetch(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, sessionId, refetch]);

  async function markHandled(id: string) {
    setError(null);
    const { error: dbError } = await supabase
      .from("problem_reports")
      .update({ resolved_at: new Date().toISOString(), resolved_by: organiserId })
      .eq("id", id);
    if (dbError) setError(dbError.message);
    else void refetch();
  }

  const open = reports.filter((r) => !r.resolved_at).length;

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        Problems reported
        {open > 0 && <span className="rounded-full bg-red-600 px-2 py-0.5 text-sm font-bold text-white">{open}</span>}
      </h2>
      {reports.length === 0 && <p className="text-slate-600">None yet. Volunteers report problems from their checklist.</p>}
      <ul className="space-y-2">
        {reports.map((r) => (
          <li
            key={r.id}
            className={`rounded-lg border-l-4 p-3 ${r.resolved_at ? "border-slate-300 bg-slate-50" : "border-red-600 bg-red-50"}`}
          >
            <p className={`font-semibold ${r.resolved_at ? "text-slate-600" : "text-red-900"}`}>
              {PROBLEM_LABEL[r.kind]} · {r.unitLabel}
            </p>
            <p className="text-sm text-slate-700">
              {r.reporter_name ?? "Volunteer"} · {formatClock(r.created_at)}
              {r.resolved_at && ` · handled ${formatClock(r.resolved_at)}`}
            </p>
            {r.note && <p className="mt-1">&ldquo;{r.note}&rdquo;</p>}
            {!r.resolved_at && (
              <button
                type="button"
                onClick={() => markHandled(r.id)}
                className="mt-2 rounded-lg border-2 border-slate-400 bg-white px-3 py-1 text-sm font-semibold"
              >
                Mark handled
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
