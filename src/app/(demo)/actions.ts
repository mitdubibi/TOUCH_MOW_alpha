"use server";

import { createClient } from "@supabase/supabase-js";
import { todayInSingapore } from "@/lib/dates";
import { demoSeed } from "@/lib/demo/seed";

// "Reset demo data": put the shared demo tables back to the start, with dates relative to today.
// Elderly links (unit tokens) are kept. Every open phone reloads through realtime.
// DEMO ONLY: anyone can press this, and it uses the public anon key (see 0008_testers.sql).
// With real login, check here that the caller is an organiser.
export async function resetDemoData(): Promise<{ error?: string }> {
  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const seed = demoSeed(todayInSingapore());

    const steps = [
      () => db.rpc("demo_clear"),
      () => db.from("demo_volunteers").upsert(seed.volunteers),
      () => db.from("demo_units").upsert(seed.units),
      () => db.from("demo_sessions").insert(seed.sessions),
      () => db.from("demo_deliveries").insert(seed.deliveries),
      () => db.from("demo_messages").insert(seed.messages),
    ];
    for (const step of steps) {
      const { error } = await step();
      if (error) return { error: error.message };
    }
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
