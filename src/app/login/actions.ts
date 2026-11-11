"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Shared test logins for the @touch names. Each password is the login name itself, so anyone who knows the name
// gets in. They must only ever point at made-up accounts and fake households.
// Staff and volunteer test logins open this Supabase account. A missing account is made on first login.
const ACCOUNTS: Record<string, { email: string; password: string; name: string }> = {
  "organizer@touch": { email: "organizer@touch", password: "organizer@touch", name: "TOUCH test" },
  "organiser@touch": { email: "organizer@touch", password: "organiser@touch", name: "TOUCH test" },
  "test@touch": { email: "test@touch", password: "test@touch", name: "Test volunteer" },
};
// Elderly logins open the household's recipient page (/t/<token>), which needs no account.
const RECIPIENTS: Record<string, { password: string; postal: string; unit: string }> = {
  "ahma@touch": { password: "ahma@touch", postal: "640501", unit: "#03-110" },
  "ahgong@touch": { password: "ahgong@touch", postal: "640518", unit: "#05-123" },
};

const WRONG = "That email or password is wrong.";

export async function testLogin(name: string, password: string): Promise<{ error: string }> {
  const key = name.trim().toLowerCase();
  const admin = createAdminClient();

  const account = ACCOUNTS[key];
  if (account) {
    if (password !== account.password) return { error: WRONG };
    // New accounts start as volunteers (see handle_new_user). The organiser account is made with npm run dev-user.
    const made = await admin.auth.admin.createUser({
      email: account.email,
      email_confirm: true,
      user_metadata: { display_name: account.name },
    });
    if (made.error && !/already been registered|already exists/i.test(made.error.message)) {
      return { error: made.error.message };
    }
    // Same as a magic link, but verified here on the server so no email is sent.
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: account.email });
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
    if (password !== home.password) return { error: WRONG };
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

  return { error: WRONG };
}
