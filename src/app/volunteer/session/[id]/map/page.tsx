import Link from "next/link";
import { notFound } from "next/navigation";
import { RouteDetails, RouteSummary } from "@/components/route/RouteSummary";
import { requireUser } from "@/lib/auth";
import { fetchBlockPhotos } from "@/lib/blocks";
import { formatTime, SLOT_LABEL } from "@/lib/dates";
import { fetchChecklist, fetchSession } from "@/lib/deliveries";
import { planRoute } from "@/lib/route/plan";

export default async function VolunteerRouteMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const session = await fetchSession(supabase, id);
  if (!session) notFound();
  const items = await fetchChecklist(supabase, id);
  const [plan, photos] = await Promise.all([
    planRoute(supabase, id, items),
    fetchBlockPhotos(supabase, items.map((i) => i.postal_code)),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">
          Route · {SLOT_LABEL[session.slot]} {formatTime(session.start_time)}
        </h1>
        <Link href={`/volunteer/session/${id}`} className="shrink-0 font-semibold text-teal-800 underline">
          Checklist
        </Link>
      </div>
      <RouteSummary plan={plan} />
      <RouteDetails plan={plan} items={items} photos={photos} />
    </div>
  );
}
