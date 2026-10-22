"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatClock, formatDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";

type BugReport = {
  id: string;
  role: string;
  what_did: string;
  what_happened: string;
  phone_model: string;
  created_at: string;
};

// Singapore date of a timestamp, e.g. "2026-10-21".
const sgDate = (iso: string) => new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(0, 10);

// Organiser Today screen: bug reports sent from /test, newest first, live.
export function BugReports() {
  const supabase = useMemo(() => createClient(), []);
  const [reports, setReports] = useState<BugReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: dbError } = await supabase
      .from("bug_reports")
      .select("id, role, what_did, what_happened, phone_model, created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<BugReport[]>();
    if (dbError) setError(dbError.message);
    else setReports(data);
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("bug-reports")
      .on("postgres_changes", { event: "*", schema: "public", table: "bug_reports" }, () => void load())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void load();
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  return (
    <details className="rounded-2xl border-2 border-navy/10 p-4">
      <summary className="cursor-pointer text-lg font-bold text-navy">Bug reports from testers ({reports?.length ?? 0})</summary>
      {error && <p className="mt-2 text-sm text-red-700">Could not load bug reports: {error}</p>}
      {reports?.length === 0 && <p className="mt-2 text-slate-600">None yet.</p>}
      <ul className="mt-3 space-y-3">
        {reports?.map((r) => (
          <li key={r.id} className="rounded-xl bg-navy/5 p-3 text-sm">
            <p className="font-semibold text-navy">
              {r.role} · {r.phone_model || "phone not given"} · {formatDate(sgDate(r.created_at))} {formatClock(r.created_at)}
            </p>
            <p className="mt-1">
              <span className="font-semibold">Did: </span>
              {r.what_did}
            </p>
            <p>
              <span className="font-semibold">Happened: </span>
              {r.what_happened}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}
