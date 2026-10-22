import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatLink } from "@/components/chat/ChatLink";
import { Checklist } from "@/components/checklist/Checklist";
import { ShareLocation } from "@/components/live/ShareLocation";
import { RouteSummary } from "@/components/route/RouteSummary";
import { requireUser } from "@/lib/auth";
import { fetchBlockPhotos } from "@/lib/blocks";
import { formatDate, formatTime, SLOT_LABEL } from "@/lib/dates";
import { fetchChecklist, fetchSession } from "@/lib/deliveries";
import { fetchLatestMessage } from "@/lib/messages";
import { planRoute, routeOrder } from "@/lib/route/plan";

export default async function VolunteerSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const session = await fetchSession(supabase, id);
  if (!session) notFound();
  const [items, { data: me }, latestMessage] = await Promise.all([
    fetchChecklist(supabase, id),
    supabase
      .from("session_volunteers")
      .select("sharing_location")
      .eq("session_id", id)
      .eq("volunteer_id", user.id)
      .maybeSingle<{ sharing_location: boolean }>(),
    fetchLatestMessage(supabase, id),
  ]);
  const [plan, photos] = await Promise.all([
    planRoute(supabase, id, items),
    fetchBlockPhotos(supabase, items.map((i) => i.postal_code)),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          {SLOT_LABEL[session.slot]} · {formatTime(session.start_time)}
        </h1>
        <p className="text-slate-700">
          {formatDate(session.date)} · collect at {session.centres?.name}
          {session.centres?.address && `, ${session.centres.address}`}
        </p>
      </div>
      {me && (
        <ShareLocation sessionId={id} initialSharing={me.sharing_location} ended={session.status === "done"} />
      )}
      <RouteSummary plan={plan} />
      {plan.ok && plan.stops.length > 0 && (
        <Link
          href={`/volunteer/session/${id}/map`}
          className="block rounded-xl bg-navy px-4 py-3 text-center text-lg font-semibold text-white"
        >
          See route on map
        </Link>
      )}
      <ChatLink href={`/volunteer/session/${id}/chat`} latest={latestMessage} />
      <Checklist
        sessionId={id}
        initialItems={items}
        routeOrder={routeOrder(plan)}
        mappedStops={plan.ok ? plan.stops.length : 0}
        blockPhotos={photos}
      />
    </div>
  );
}
