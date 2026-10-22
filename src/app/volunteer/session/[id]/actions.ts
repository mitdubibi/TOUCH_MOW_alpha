"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { fetchChecklist } from "@/lib/deliveries";
import { planRoute } from "@/lib/route/plan";
import type { StoredRoute } from "@/lib/track/eta";

// Start delivery: save this volunteer's route (for recipients' ETAs), turn on sharing and mark the session live.
export async function startDelivery(sessionId: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const items = await fetchChecklist(supabase, sessionId);
  const plan = await planRoute(supabase, sessionId, items);
  const route: StoredRoute | null = plan.ok
    ? {
        centre: { lat: plan.centre.lat, lng: plan.centre.lng },
        totalSeconds: plan.totalSeconds,
        stops: plan.stops.map((s) => ({ postalCode: s.postalCode, lat: s.lat, lng: s.lng, legSeconds: s.legSeconds })),
      }
    : null;

  const { error } = await supabase.rpc("start_delivery", { p_session_id: sessionId, p_route: route });
  if (error) return { error: error.message };
  revalidatePath(`/volunteer/session/${sessionId}`);
  return {};
}

export async function stopSharing(sessionId: string): Promise<{ error?: string }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("stop_sharing", { p_session_id: sessionId });
  if (error) return { error: error.message };
  revalidatePath(`/volunteer/session/${sessionId}`);
  return {};
}
