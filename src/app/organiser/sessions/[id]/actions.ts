"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireOrganiser } from "@/lib/auth";

export async function addToTeam(formData: FormData) {
  const { supabase } = await requireOrganiser();
  const sessionId = String(formData.get("sessionId"));
  const volunteerId = String(formData.get("volunteerId") ?? "");
  if (!volunteerId) return;
  const { error } = await supabase
    .from("session_volunteers")
    .insert({ session_id: sessionId, volunteer_id: volunteerId });
  // 23505: already on the team.
  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath(`/organiser/sessions/${sessionId}`);
}

export async function removeFromTeam(formData: FormData) {
  const { supabase } = await requireOrganiser();
  const sessionId = String(formData.get("sessionId"));
  const volunteerId = String(formData.get("volunteerId"));
  const { error } = await supabase
    .from("session_volunteers")
    .delete()
    .eq("session_id", sessionId)
    .eq("volunteer_id", volunteerId);
  if (error) throw new Error(error.message);
  revalidatePath(`/organiser/sessions/${sessionId}`);
}

// Ends the session for everyone: volunteers stop sharing and their last positions are deleted.
export async function endSession(formData: FormData) {
  const { supabase } = await requireOrganiser();
  const sessionId = String(formData.get("sessionId"));
  const { error } = await supabase.rpc("end_session", { p_session_id: sessionId });
  if (error) throw new Error(error.message);
  revalidatePath(`/organiser/sessions/${sessionId}`);
}

// A fresh private link for one unit. The old link stops working at once.
export async function newTrackLink(formData: FormData) {
  const { supabase } = await requireOrganiser();
  const sessionId = String(formData.get("sessionId"));
  const unitId = String(formData.get("unitId"));
  const { error } = await supabase
    .from("unit_contacts")
    .update({ track_token: randomBytes(32).toString("hex"), token_revoked_at: null })
    .eq("unit_id", unitId);
  if (error) throw new Error(error.message);
  revalidatePath(`/organiser/sessions/${sessionId}`);
}
