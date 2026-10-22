import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistItem, DeliveryStatus, ProblemKind, SessionSummary } from "@/types/db";

export const SESSION_SELECT = "id, date, slot, start_time, status, centres(name, address)";

type RawDelivery = {
  id: string;
  status: DeliveryStatus;
  meal_type: string;
  remarks: string | null;
  done_at: string | null;
  photo_requested_at: string | null;
  photo_request_note: string | null;
  photo_path: string | null;
  problem_reports: { kind: ProblemKind; created_at: string }[];
  units: { unit_no: string; floor: number; postal_code: string; blocks: { block_no: string } };
};

// Works with both the browser and the server Supabase client. RLS decides which rows come back.
export async function fetchChecklist(supabase: SupabaseClient, sessionId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from("deliveries")
    .select(
      "id, status, meal_type, remarks, done_at, photo_requested_at, photo_request_note, photo_path, " +
        "problem_reports(kind, created_at), " +
        "units!inner(unit_no, floor, postal_code, blocks!inner(block_no))",
    )
    .eq("session_id", sessionId)
    .returns<RawDelivery[]>();
  if (error) throw error;
  return data.map((d) => ({
    id: d.id,
    status: d.status,
    meal_type: d.meal_type,
    remarks: d.remarks,
    done_at: d.done_at,
    photo_requested_at: d.photo_requested_at,
    photo_request_note: d.photo_request_note,
    photo_path: d.photo_path,
    problems: [...d.problem_reports].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    unit_no: d.units.unit_no,
    floor: d.units.floor,
    postal_code: d.units.postal_code,
    block_no: d.units.blocks.block_no,
  }));
}

export async function fetchSession(supabase: SupabaseClient, sessionId: string) {
  const { data } = await supabase
    .from("sessions")
    .select(SESSION_SELECT)
    .eq("id", sessionId)
    .maybeSingle<SessionSummary>();
  return data;
}

// Status of every delivery in these sessions, for progress bars on session lists.
export async function fetchStatusesBySession(supabase: SupabaseClient, sessionIds: string[]) {
  const bySession = new Map<string, DeliveryStatus[]>();
  if (!sessionIds.length) return bySession;
  const { data } = await supabase
    .from("deliveries")
    .select("session_id, status")
    .in("session_id", sessionIds)
    .returns<{ session_id: string; status: DeliveryStatus }[]>();
  for (const row of data ?? []) {
    const list = bySession.get(row.session_id) ?? [];
    list.push(row.status);
    bySession.set(row.session_id, list);
  }
  return bySession;
}
