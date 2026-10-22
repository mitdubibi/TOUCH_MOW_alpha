import Link from "next/link";
import { notFound } from "next/navigation";
import { SessionChat } from "@/components/chat/SessionChat";
import { requireOrganiser } from "@/lib/auth";
import { formatDate, formatTime, SLOT_LABEL } from "@/lib/dates";
import { fetchSession } from "@/lib/deliveries";
import { fetchTeamMessages } from "@/lib/messages";

export default async function OrganiserChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireOrganiser();

  const session = await fetchSession(supabase, id);
  if (!session) notFound();
  const messages = await fetchTeamMessages(supabase, id);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Team chat</h1>
          <p className="text-slate-700">
            {formatDate(session.date)} · {SLOT_LABEL[session.slot]} {formatTime(session.start_time)}
          </p>
        </div>
        <Link href={`/organiser/sessions/${id}`} className="shrink-0 font-semibold text-teal-800 underline">
          Session
        </Link>
      </div>
      <p className="text-sm text-slate-600">Everyone on this session&apos;s team sees these messages.</p>
      <SessionChat sessionId={id} meId={user.id} initialMessages={messages} />
    </div>
  );
}
