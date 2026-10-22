"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  { value: "volunteer", label: "Volunteer" },
  { value: "organiser", label: "Organiser" },
  { value: "elderly", label: "Elderly" },
  { value: "other", label: "Other" },
];

// Testers' bug reports go to the bug_reports table (0008_testers.sql). Organisers see them on the demo Today screen.
export function BugReportForm() {
  const supabase = useMemo(() => createClient(), []);
  const [role, setRole] = useState("volunteer");
  const [whatDid, setWhatDid] = useState("");
  const [whatHappened, setWhatHappened] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!whatDid.trim() || !whatHappened.trim()) return;
    setSending(true);
    setError(null);
    const { error: dbError } = await supabase.from("bug_reports").insert({
      role,
      what_did: whatDid.trim(),
      what_happened: whatHappened.trim(),
      phone_model: phone.trim(),
      page: document.referrer ? new URL(document.referrer).pathname.slice(0, 200) : "/test",
      user_agent: navigator.userAgent.slice(0, 400),
    });
    setSending(false);
    if (dbError) {
      setError(`Not sent: ${dbError.message}. Please try again, or message the person who sent you the link.`);
      return;
    }
    setSent(true);
    setWhatDid("");
    setWhatHappened("");
  }

  if (sent) {
    return (
      <div className="space-y-3 rounded-2xl bg-sun-light p-4 text-navy" role="status">
        <p className="text-lg font-bold">Thank you! Your report was sent.</p>
        <button type="button" onClick={() => setSent(false)} className="font-semibold underline">
          Report another bug
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-3">
      <label className="block">
        <span className="font-semibold text-navy">I was testing as</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mt-1 block w-full rounded-xl border-2 border-navy/20 bg-white px-3 py-2"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-semibold text-navy">What did you do?</span>
        <textarea
          required
          value={whatDid}
          onChange={(e) => setWhatDid(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="e.g. Ticked Blk 513 #04-301 on Volunteer 1"
          className="mt-1 block w-full rounded-xl border-2 border-navy/20 p-3"
        />
      </label>
      <label className="block">
        <span className="font-semibold text-navy">What happened?</span>
        <textarea
          required
          value={whatHappened}
          onChange={(e) => setWhatHappened(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="e.g. The organiser count did not change"
          className="mt-1 block w-full rounded-xl border-2 border-navy/20 p-3"
        />
      </label>
      <label className="block">
        <span className="font-semibold text-navy">Phone model</span>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          maxLength={100}
          placeholder="e.g. iPhone 13, Samsung A54"
          className="mt-1 block w-full rounded-xl border-2 border-navy/20 px-3 py-2"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <button
        disabled={sending || !whatDid.trim() || !whatHappened.trim()}
        className="w-full rounded-xl bg-navy py-3 text-lg font-bold text-sun disabled:opacity-40"
      >
        {sending ? "Sending..." : "Send bug report"}
      </button>
    </form>
  );
}
