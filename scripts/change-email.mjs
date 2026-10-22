// Dev helper: change a user's login email, keeping their account, role and name.
// The new email counts as confirmed, so no confirmation email is sent.
//
//   npm run change-email -- <current email> <new email>
//
// Reads .env.local. Uses the service role key, so only run it on your own machine.

import { createClient } from "@supabase/supabase-js";

const [from, to] = process.argv.slice(2).map((e) => e?.trim().toLowerCase());
if (!from || !to) {
  console.error("Usage: npm run change-email -- <current email> <new email>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

// A handful of test users, so the first page is enough.
const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (error) {
  console.error(error.message);
  process.exit(1);
}
const user = data.users.find((u) => u.email?.toLowerCase() === from);
if (!user) {
  console.error(`No user with the email ${from}.`);
  process.exit(1);
}

const updated = await supabase.auth.admin.updateUserById(user.id, { email: to, email_confirm: true });
if (updated.error) {
  console.error(updated.error.message);
  process.exit(1);
}
console.log(`${from} is now ${to}. They log in with the new email from now on.`);
