import Link from "next/link";
import { HeartLogo } from "@/components/ui/HeartLogo";
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

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <HeartLogo className="h-12 w-12 text-brand" />
      <h1 className="mt-3 text-3xl font-bold">
        <span className="text-brand">TOUCH</span> Meals on Wheels
      </h1>
      <p className="mt-2 text-slate-700">Log in with your email and password. No password yet? We can email you a code.</p>
      {error && ERRORS[error] && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">
          {ERRORS[error]}
        </p>
      )}
      {user && profile && (
        <div className="mt-6 space-y-2 rounded-lg border border-brand p-4">
          <p>
            You are logged in as <strong>{profile.display_name || user.email}</strong>.
          </p>
          <Link
            href="/me"
            className="block w-full rounded-lg bg-brand py-3 text-center text-lg font-semibold text-white"
          >
            Continue as {profile.display_name || user.email}
          </Link>
          <form action="/auth/signout" method="post">
            <button className="text-sm text-brand-dark underline">Log out</button>
          </form>
        </div>
      )}
      <LoginForm />
    </main>
  );
}
