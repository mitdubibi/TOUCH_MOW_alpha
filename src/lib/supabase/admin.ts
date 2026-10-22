import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service role client that skips RLS. Server only: never import this from a Client Component.
// Used to write shared caches (OneMap geocodes and walking times) that volunteers may not write themselves.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set in .env.local");
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
