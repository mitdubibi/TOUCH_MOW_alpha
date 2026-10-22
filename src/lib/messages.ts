import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage } from "@/types/db";

export const MESSAGE_SELECT = "id, session_id, sender_id, sender_name, sender_is_organiser, body, created_at";
const CHAT_LIMIT = 200;

// The session's team chat, oldest first (the newest 200). RLS: organisers, and volunteers on the session.
export async function fetchTeamMessages(supabase: SupabaseClient, sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("thread_type", "team")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(CHAT_LIMIT)
    .returns<ChatMessage[]>();
  if (error) throw error;
  return data.reverse();
}

// For the "Team chat" button: the newest message, if any.
export async function fetchLatestMessage(supabase: SupabaseClient, sessionId: string) {
  const { data } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("thread_type", "team")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ChatMessage>();
  return data;
}
