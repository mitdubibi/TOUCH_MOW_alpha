"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { quickLogin } from "./actions";

// Volunteers: email, then the code from the email. Only accounts made by TOUCH can log in.
// Test logins ending in @touch (organiser, elderly) skip the email; see actions.ts.
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (!error) return setStep("code");
    setError(
      /signups not allowed/i.test(error.message)
        ? "This email is not on the volunteer list. Please ask the TOUCH coordinator."
        : error.message,
    );
  }

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (/@touch$/i.test(email.trim())) {
      // Redirects on success, so this only returns with an error.
      setError((await quickLogin(email)).error);
    } else {
      await sendCode();
    }
    setBusy(false);
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) {
      setError("That code is wrong or has expired. Check the latest email or send a new code.");
      setBusy(false);
    } else {
      window.location.replace("/me");
    }
  }

  if (step === "code") {
    return (
      <form onSubmit={onSubmitCode} className="mt-6 space-y-3">
        <p className="rounded-lg bg-teal-50 p-4 text-teal-900">
          We sent a code to <strong>{email.trim()}</strong>. Type it below.
        </p>
        <label className="block">
          <span className="font-medium">Code</span>
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-400 px-3 py-3 text-center text-2xl tracking-widest"
          />
        </label>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-teal-700 py-3 text-lg font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Checking..." : "Log in"}
        </button>
        <div className="flex justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="text-teal-800 underline"
          >
            Use a different email
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              await sendCode();
              setBusy(false);
            }}
            className="text-teal-800 underline"
          >
            Send a new code
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmitEmail} className="mt-6 space-y-3">
      <label className="block">
        <span className="font-medium">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-400 px-3 py-3 text-lg"
        />
      </label>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="w-full rounded-lg bg-teal-700 py-3 text-lg font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Please wait..." : "Continue"}
      </button>
    </form>
  );
}
