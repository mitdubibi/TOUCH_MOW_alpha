import Link from "next/link";
import { cookies } from "next/headers";
import { RECIPIENT_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

const ERRORS: Record<string, string> = {
  link: "That login link has expired or was already used. Please ask for a new one.",
  profile: "Your account is not set up yet. Please contact the TOUCH coordinator.",
};

// The app on the home screen opens here. The form always shows; anyone already logged in also gets a button to
// carry on, so a shared test phone can switch account without logging out first.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle<{ display_name: string | null }>()
    : { data: null };
  const recipient = (await cookies()).get(RECIPIENT_COOKIE)?.value;
  const recipientHref = recipient && /^[0-9a-f]{64}$/.test(recipient) ? `/t/${recipient}` : null;

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-3xl font-bold">Meals on Wheels</h1>
      <p className="mt-2 text-slate-700">Log in with your email. We will send you a code, no password needed.</p>
      {error && ERRORS[error] && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">
          {ERRORS[error]}
        </p>
      )}
      {user && profile && (
        <div className="mt-6 space-y-2 rounded-lg border border-teal-700 p-4">
          <p>
            You are logged in as <strong>{profile.display_name || user.email}</strong>.
          </p>
          <Link
            href="/me"
            className="block w-full rounded-lg bg-teal-700 py-3 text-center text-lg font-semibold text-white"
          >
            Continue as {profile.display_name || user.email}
          </Link>
          <form action="/auth/signout" method="post">
            <button className="text-sm text-teal-800 underline">Log out</button>
          </form>
        </div>
      )}
      {!user && recipientHref && (
        <Link
          href={recipientHref}
          className="mt-6 block w-full rounded-lg bg-teal-700 py-3 text-center text-lg font-semibold text-white"
        >
          Open my meal page
        </Link>
      )}
      <LoginForm />
    </main>
  );
}
