import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProblemKind } from "@/types/db";

// Same choices as the /demo prototype.
export const PROBLEM_LABEL: Record<ProblemKind, string> = {
  uneaten: "Meal uneaten",
  no_answer: "No answer",
  wrong_address: "Wrong address",
};

export const PROBLEM_KINDS = Object.keys(PROBLEM_LABEL) as ProblemKind[];

export type ProblemReport = {
  id: string;
  kind: ProblemKind;
  note: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter_name: string | null;
  unitLabel: string;
};

type RawReport = Omit<ProblemReport, "unitLabel"> & {
  deliveries: { units: { unit_no: string; blocks: { block_no: string } } };
};

// Every report in a session, open ones first, newest first. Organisers only (RLS lets volunteers see their session too).
export async function fetchProblemReports(supabase: SupabaseClient, sessionId: string): Promise<ProblemReport[]> {
  const { data, error } = await supabase
    .from("problem_reports")
    .select(
      "id, kind, note, created_at, resolved_at, reporter_name, " +
        "deliveries!inner(units!inner(unit_no, blocks!inner(block_no)))",
    )
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .returns<RawReport[]>();
  if (error) throw error;
  return data
    .map(({ deliveries, ...r }) => ({
      ...r,
      unitLabel: `Blk ${deliveries.units.blocks.block_no} ${deliveries.units.unit_no}`,
    }))
    .sort((a, b) => Number(!!a.resolved_at) - Number(!!b.resolved_at));
}
