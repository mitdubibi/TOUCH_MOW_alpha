"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Shared test logins that skip the email code. Anyone who types one is let in, so they must only ever point at
// made-up accounts and fake households.
const ORGANISERS: Record<string, string> = {
  "organizer@touch": "organizer@touch",
  "organiser@touch": "organizer@touch",
};
// Elderly logins open the household's recipient page (/t/<token>), which needs no account.
const RECIPIENTS: Record<string, { postal: string; unit: string }> = {
  "ahma@touch": { postal: "640501", unit: "#03-110" },
  "ahgong@touch": { postal: "640518", unit: "#05-123" },
};

export async function quickLogin(name: string): Promise<{ error: string }> {
  const key = name.trim().toLowerCase();
  const admin = createAdminClient();

  const organiserEmail = ORGANISERS[key];
  if (organiserEmail) {
    // Same as a magic link, but verified here on the server so no email is sent.
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: organiserEmail });
    if (link.error) return { error: link.error.message };
    const { error } = await (await createClient()).auth.verifyOtp({
      type: "magiclink",
      token_hash: link.data.properties.hashed_token,
    });
    if (error) return { error: error.message };
    redirect("/me");
  }

  const home = RECIPIENTS[key];
  if (home) {
    const { data } = await admin
      .from("units")
      .select("unit_contacts(track_token)")
      .eq("postal_code", home.postal)
      .eq("unit_no", home.unit)
      .maybeSingle<{ unit_contacts: { track_token: string } | null }>();
    const token = data?.unit_contacts?.track_token;
    if (!token) return { error: "This home is not set up yet. Please contact the TOUCH coordinator." };
    // A shared test phone may still be logged in as a volunteer or organiser.
    await (await createClient()).auth.signOut();
    redirect(`/t/${token}`);
  }

  return { error: "That login name is not known." };
}
