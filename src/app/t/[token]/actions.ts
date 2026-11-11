"use server";

import { createAdminClient } from "@/lib/supabase/admin";

const MAX_PER_DAY = 20;

// A message from a recipient's private link to TOUCH. No login: the token says which home it is from.
// Saved as a 'recipient' message, which only organisers can read.
export async function sendRecipientMessage(token: string, body: string): Promise<{ ok: true } | { error: string }> {
  const text = body.trim().slice(0, 500);
  if (!text) return { error: "empty" };
  if (!/^[0-9a-f]{64}$/.test(token)) return { error: "invalid" };

  const admin = createAdminClient();
  const { data: contact } = await admin
    .from("unit_contacts")
    .select("unit_id, token_revoked_at")
    .eq("track_token", token)
    .maybeSingle<{ unit_id: string; token_revoked_at: string | null }>();
  if (!contact || contact.token_revoked_at) return { error: "invalid" };

  // Anyone with the link can send, so cap how many one home can send in a day.
  const { count } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("thread_type", "recipient")
    .eq("unit_id", contact.unit_id)
    .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString());
  if ((count ?? 0) >= MAX_PER_DAY) return { error: "limit" };

  const { error } = await admin.from("messages").insert({ thread_type: "recipient", unit_id: contact.unit_id, body: text });
  if (error) return { error: error.message };
  return { ok: true };
}
