import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RECIPIENT_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

const ERRORS: Record<string, string> = {
  link: "That login link has expired or was already used. Please ask for a new one.",
  profile: "Your account is not set up yet. Please contact the TOUCH coordinator.",
};

// The app on the home screen opens here. Anyone already logged in goes straight on (?switch=1 shows the form anyway).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; switch?: string }>;
}) {
  const { error, switch: switching } = await searchParams;
  if (!error && !switching) {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (user) redirect("/me");
    const recipient = (await cookies()).get(RECIPIENT_COOKIE)?.value;
    if (recipient && /^[0-9a-f]{64}$/.test(recipient)) redirect(`/t/${recipient}`);
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-3xl font-bold">Meals on Wheels</h1>
      <p className="mt-2 text-slate-700">Log in with your email. We will send you a code, no password needed.</p>
      {error && ERRORS[error] && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">
          {ERRORS[error]}
        </p>
      )}
      <LoginForm />
    </main>
  );
}
