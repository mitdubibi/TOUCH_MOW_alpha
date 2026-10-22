import { notFound } from "next/navigation";
import { ChatLink } from "@/components/chat/ChatLink";
import { Checklist } from "@/components/checklist/Checklist";
import { ProblemReports } from "@/components/problems/ProblemReports";
import { RouteDetails, RouteSummary } from "@/components/route/RouteSummary";
import { RecipientLinks, type RecipientLink } from "@/components/track/RecipientLinks";
import { requireOrganiser } from "@/lib/auth";
import { fetchBlockPhotos } from "@/lib/blocks";
import { formatClock, formatDate, formatTime, SLOT_LABEL } from "@/lib/dates";
import { fetchChecklist, fetchSession } from "@/lib/deliveries";
import { fetchLatestMessage } from "@/lib/messages";
import { fetchProblemReports } from "@/lib/problems";
import { planRoute, routeOrder } from "@/lib/route/plan";
import { compareBlockNumbers, compareUnitsTopDown } from "@/lib/units";
import type { Profile, ReminderKind } from "@/types/db";
import { addToTeam, endSession, removeFromTeam } from "./actions";

type TeamRow = { volunteer_id: string; sharing_location: boolean; profiles: { display_name: string } | null };
type LocationRow = { volunteer_id: string; lat: number; lng: number };
type ReminderStatus = {
  volunteer_id: string;
  kind: ReminderKind;
  sent_at: string | null;
  email_sent_at: string | null;
  error: string | null;
};
type LinkRow = {
  unit_id: string;
  status: string;
  units: {
    unit_no: string;
    floor: number;
    postal_code: string;
    blocks: { block_no: string };
    // One-to-one, but PostgREST may return it as a list.
    unit_contacts: { track_token: string } | { track_token: string }[] | null;
  };
};

const STATUS_BADGE = {
  planned: "bg-slate-100 text-slate-800",
  live: "bg-teal-100 text-teal-900",
  done: "bg-slate-200 text-slate-600",
};

export default async function OrganiserSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireOrganiser();

  const session = await fetchSession(supabase, id);
  if (!session) notFound();

  const [
    items,
    { data: team },
    { data: volunteers },
    { data: locations },
    { data: linkRows },
    { data: reminders },
    problems,
    latestMessage,
  ] = await Promise.all([
    fetchChecklist(supabase, id),
    supabase
      .from("session_volunteers")
      .select("volunteer_id, sharing_location, profiles(display_name)")
      .eq("session_id", id)
      .returns<TeamRow[]>(),
    supabase
      .from("profiles")
      .select("id, role, display_name")
      .eq("role", "volunteer")
      .order("display_name")
      .returns<Profile[]>(),
    supabase.from("volunteer_locations").select("volunteer_id, lat, lng").eq("session_id", id).returns<LocationRow[]>(),
    supabase
      .from("deliveries")
      .select("unit_id, status, units!inner(unit_no, floor, postal_code, blocks!inner(block_no), unit_contacts(track_token))")
      .eq("session_id", id)
      .neq("status", "cancelled")
      .returns<LinkRow[]>(),
    supabase
      .from("reminders")
      .select("volunteer_id, kind, sent_at, email_sent_at, error")
      .eq("session_id", id)
      .order("sent_at")
      .returns<ReminderStatus[]>(),
    fetchProblemReports(supabase, id),
    fetchLatestMessage(supabase, id),
  ]);

  const [plan, photos] = await Promise.all([
    planRoute(supabase, id, items),
    fetchBlockPhotos(supabase, items.map((i) => i.postal_code)),
  ]);
  const order = routeOrder(plan) ?? [];
  const onTeam = new Set((team ?? []).map((t) => t.volunteer_id));
  const available = (volunteers ?? []).filter((v) => !onTeam.has(v.id));
  const names = Object.fromEntries((team ?? []).map((t) => [t.volunteer_id, t.profiles?.display_name ?? "Volunteer"]));

  // Recipient links in walking order, top floor first in each block.
  const rank = (postal: string) => (order.includes(postal) ? order.indexOf(postal) : Number.MAX_SAFE_INTEGER);
  const links: RecipientLink[] = (linkRows ?? [])
    .map((r) => ({ ...r, contact: Array.isArray(r.units.unit_contacts) ? r.units.unit_contacts[0] : r.units.unit_contacts }))
    .filter((r) => r.contact)
    .sort(
      (a, b) =>
        rank(a.units.postal_code) - rank(b.units.postal_code) ||
        compareBlockNumbers(a.units.blocks.block_no, b.units.blocks.block_no) ||
        compareUnitsTopDown(a.units, b.units),
    )
    .map((r) => ({ unitId: r.unit_id, label: `Blk ${r.units.blocks.block_no} ${r.units.unit_no}`, token: r.contact!.track_token }));

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            {formatDate(session.date)} · {SLOT_LABEL[session.slot]}
          </h1>
          <p className="text-slate-700">
            {session.centres?.name} · starts {formatTime(session.start_time)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${STATUS_BADGE[session.status]}`}>
          {session.status === "planned" ? "Not started" : session.status === "live" ? "Live" : "Ended"}
        </span>
      </div>

      <ProblemReports sessionId={id} organiserId={user.id} initialReports={problems} />

      <section className="space-y-3 rounded-xl border border-slate-200 p-4">
        <h2 className="text-lg font-semibold">Team</h2>
        {!team?.length && <p className="text-slate-600">No volunteers yet.</p>}
        <ul className="space-y-2">
          {team?.map((t) => (
            <li key={t.volunteer_id} className="flex items-center justify-between gap-2">
              <span>
                {t.profiles?.display_name}
                {t.sharing_location && (
                  <span className="ml-2 rounded bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-900">
                    Sharing location
                  </span>
                )}
                <ReminderLine rows={(reminders ?? []).filter((r) => r.volunteer_id === t.volunteer_id)} />
              </span>
              <form action={removeFromTeam}>
                <input type="hidden" name="sessionId" value={id} />
                <input type="hidden" name="volunteerId" value={t.volunteer_id} />
                <button className="text-sm text-red-700 underline">Remove</button>
              </form>
            </li>
          ))}
        </ul>
        {available.length > 0 && (
          <form action={addToTeam} className="flex gap-2">
            <input type="hidden" name="sessionId" value={id} />
            <select name="volunteerId" className="flex-1 rounded-lg border border-slate-400 bg-white px-3 py-2">
              {available.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.display_name}
                </option>
              ))}
            </select>
            <button className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">Add</button>
          </form>
        )}
        <ChatLink href={`/organiser/sessions/${id}/chat`} latest={latestMessage} />
        {session.status === "live" && (
          <form action={endSession}>
            <input type="hidden" name="sessionId" value={id} />
            <button className="w-full rounded-lg border-2 border-red-700 px-4 py-2 font-semibold text-red-800">
              End session and stop location sharing
            </button>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Route</h2>
        <RouteSummary plan={plan} />
        <RouteDetails
          plan={plan}
          items={items}
          photos={photos}
          live={{
            sessionId: id,
            names,
            volunteers: (locations ?? []).map((l) => ({
              id: l.volunteer_id,
              name: names[l.volunteer_id] ?? "Volunteer",
              lat: l.lat,
              lng: l.lng,
            })),
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Delivery list</h2>
        <Checklist
          sessionId={id}
          initialItems={items}
          showCancelled
          routeOrder={routeOrder(plan)}
          mappedStops={plan.ok ? plan.stops.length : 0}
          blockPhotos={photos}
          canRequestPhotos
        />
      </section>

      {links.length > 0 && (
        <details className="space-y-3">
          <summary className="cursor-pointer text-lg font-semibold">Recipient links ({links.length})</summary>
          <p className="mt-2 text-sm text-slate-600">
            Each household gets its own private link with no login. Send it by SMS. It shows when their meal will
            arrive for every session, so it only needs sending once.
          </p>
          <RecipientLinks sessionId={id} links={links} />
        </details>
      )}
    </div>
  );
}

const REMINDER_LABEL: Record<ReminderKind, string> = { evening_before: "Evening reminder", hour_before: "1 hour reminder" };

// Under a volunteer's name: which reminders went out, and whether the email got through.
function ReminderLine({ rows }: { rows: ReminderStatus[] }) {
  if (!rows.length) return <span className="block text-xs text-slate-500">No reminder sent yet</span>;
  return (
    <>
      {rows.map((r) => (
        <span key={r.kind} className="block text-xs text-slate-600">
          {REMINDER_LABEL[r.kind]} {r.sent_at && formatClock(r.sent_at)} ·{" "}
          {r.email_sent_at ? "emailed" : <span className="text-amber-800">in app only ({r.error ?? "no email"})</span>}
        </span>
      ))}
    </>
  );
}
