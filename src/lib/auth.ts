import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/db";

// For pages that need a logged-in user. Sends everyone else to /login.
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) redirect("/login?error=profile");

  return { supabase, user, profile };
}

export async function requireOrganiser() {
  const ctx = await requireUser();
  if (ctx.profile.role !== "organiser") redirect("/volunteer");
  return ctx;
}
