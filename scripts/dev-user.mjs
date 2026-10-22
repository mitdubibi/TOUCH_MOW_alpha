// Dev helper: create (or update) a user, set their role and name, and print a one-time login link.
// Skips the email step, which Supabase's free email service limits to a few per hour.
//
//   npm run dev-user -- <email> <volunteer|organiser> "<Display Name>"
//
// Reads .env.local. Uses the service role key, so only run it on your own machine.

import { createClient } from "@supabase/supabase-js";

const [email, role = "volunteer", displayName] = process.argv.slice(2);
if (!email || !["volunteer", "organiser"].includes(role)) {
  console.error('Usage: npm run dev-user -- <email> <volunteer|organiser> "<Display Name>"');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const created = await supabase.auth.admin.createUser({ email, email_confirm: true });
if (created.error && !/already been registered|already exists/i.test(created.error.message)) {
  console.error(created.error.message);
  process.exit(1);
}

const link = await supabase.auth.admin.generateLink({ type: "magiclink", email });
if (link.error) {
  console.error(link.error.message);
  process.exit(1);
}

const userId = link.data.user.id;
const update = { role };
if (displayName) update.display_name = displayName;
const { error } = await supabase.from("profiles").update(update).eq("id", userId);
if (error) {
  console.error(error.message);
  process.exit(1);
}

console.log(`${email} is now a ${role}${displayName ? ` (${displayName})` : ""}.`);
console.log("Open this link once to log in (use a separate browser profile per user):");
console.log(`${site}/auth/confirm?token_hash=${link.data.properties.hashed_token}&type=magiclink`);
