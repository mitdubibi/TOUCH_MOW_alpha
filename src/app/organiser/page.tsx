import Link from "next/link";
import { SessionCard } from "@/components/SessionCard";
import { requireOrganiser } from "@/lib/auth";
import { fetchStatusesBySession, SESSION_SELECT } from "@/lib/deliveries";
import type { SessionSummary } from "@/types/db";
import { SendRemindersForm } from "./SendRemindersForm";

export default async function OrganiserHome() {
  const { supabase } = await requireOrganiser();
  const { data: sessions } = await supabase
    .from("sessions")
    .select(SESSION_SELECT)
    .order("date", { ascending: false })
    .order("slot")
    .limit(30)
    .returns<SessionSummary[]>();
  const statuses = await fetchStatusesBySession(supabase, (sessions ?? []).map((s) => s.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sessions</h1>
        <Link href="/organiser/upload" className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">
          Upload list
        </Link>
      </div>
      <SendRemindersForm allowPretend={process.env.NODE_ENV !== "production"} />
      {!sessions?.length && <p className="text-slate-700">No sessions yet. Upload a delivery list to create one.</p>}
      {sessions?.map((s) => (
        <SessionCard key={s.id} session={s} statuses={statuses.get(s.id) ?? []} href={`/organiser/sessions/${s.id}`} />
      ))}
    </div>
  );
}
