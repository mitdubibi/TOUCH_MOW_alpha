import { SessionCard } from "@/components/SessionCard";
import { ReminderCard, type ReminderRow } from "@/components/reminders/ReminderCard";
import { requireUser } from "@/lib/auth";
import { todayInSingapore } from "@/lib/dates";
import { fetchStatusesBySession, SESSION_SELECT } from "@/lib/deliveries";
import type { SessionSummary } from "@/types/db";

export default async function VolunteerHome() {
  const { supabase, user } = await requireUser();
  const today = todayInSingapore();

  // Only sessions this volunteer is on (RLS also enforces this).
  const [{ data: mine }, { data: reminderRows }] = await Promise.all([
    supabase
      .from("session_volunteers")
      .select("session_id")
      .eq("volunteer_id", user.id)
      .returns<{ session_id: string }[]>(),
    supabase
      .from("reminders")
      .select("id, kind, session_id, sessions(date, slot, start_time, centres(name, address, postal_code))")
      .eq("volunteer_id", user.id)
      .is("read_at", null)
      .order("sent_at", { ascending: false })
      .returns<ReminderRow[]>(),
  ]);
  const ids = (mine ?? []).map((m) => m.session_id);

  // Newest unread reminder per upcoming session (the 1 hour one replaces the evening one).
  const seen = new Set<string>();
  const reminders = (reminderRows ?? []).filter(
    (r): r is ReminderRow & { sessions: NonNullable<ReminderRow["sessions"]> } => {
      if (!r.sessions || r.sessions.date < today || seen.has(r.session_id)) return false;
      seen.add(r.session_id);
      return true;
    },
  );

  const { data: sessions } = ids.length
    ? await supabase
        .from("sessions")
        .select(SESSION_SELECT)
        .in("id", ids)
        .gte("date", today)
        .order("date")
        .order("slot")
        .returns<SessionSummary[]>()
    : { data: [] as SessionSummary[] };
  const statuses = await fetchStatusesBySession(supabase, (sessions ?? []).map((s) => s.id));

  return (
    <div className="space-y-4">
      {reminders.map((r) => (
        <ReminderCard key={r.id} reminder={r} />
      ))}
      <h1 className="text-2xl font-bold">My sessions</h1>
      {!sessions?.length && (
        <p className="text-slate-700">You have no upcoming sessions. The coordinator will add you to one.</p>
      )}
      {sessions?.map((s) => (
        <SessionCard key={s.id} session={s} statuses={statuses.get(s.id) ?? []} href={`/volunteer/session/${s.id}`} />
      ))}
    </div>
  );
}
