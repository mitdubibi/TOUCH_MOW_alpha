"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { testLogin } from "./actions";

// Email and password on one screen. Test logins ending in @touch are checked on the server (see actions.ts).
// Volunteers made by TOUCH have no password: "Email me a code" sends a code instead. No one can sign up here.
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"login" | "code">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTestLogin = /@touch$/i.test(email.trim());

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

  async function onSubmitLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (isTestLogin) {
      // Redirects on success, so this only returns with an error.
      setError((await testLogin(email, password)).error);
    } else {
      const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
      if (!error) return window.location.replace("/me");
      setError("That email or password is wrong. No password? Tap Email me a code.");
    }
    setBusy(false);
  }

  async function onEmailCode() {
    setError(null);
    if (!/^\S+@\S+$/.test(email.trim())) return setError("Type your email first.");
    if (isTestLogin) return setError("Test logins use a password, not a code.");
    setBusy(true);
    await sendCode();
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
        <p className="rounded-lg bg-brand-light p-4 text-brand-dark">
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
          className="w-full rounded-lg bg-brand py-3 text-lg font-semibold text-white disabled:opacity-60"
        >
          {busy ? "Checking..." : "Log in"}
        </button>
        <div className="flex justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setStep("login");
              setCode("");
              setError(null);
            }}
            className="text-brand-dark underline"
          >
            Back to login
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
            className="text-brand-dark underline"
          >
            Send a new code
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmitLogin} className="mt-6 space-y-4">
      <label className="block">
        <span className="font-medium">Email</span>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-400 px-3 py-3 text-lg"
        />
      </label>
      <label className="block">
        <span className="font-medium">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        className="w-full rounded-lg bg-brand py-3 text-lg font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Please wait..." : "Log in"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onEmailCode}
        className="w-full text-center text-brand-dark underline disabled:opacity-60"
      >
        No password? Email me a code
      </button>
      <p className="text-sm text-slate-700">
        PDPA: by logging in, you agree TOUCH may use your name, email and delivery location only to run Meals on
        Wheels. Contact the TOUCH coordinator to see or delete your data.
      </p>
    </form>
  );
}
