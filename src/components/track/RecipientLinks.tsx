"use client";

import { useState } from "react";
import { newTrackLink } from "@/app/organiser/sessions/[id]/actions";

export type RecipientLink = { unitId: string; label: string; token: string };

// Each unit's private no-login link, to send by SMS. The token is random, not the unit number.
export function RecipientLinks({ sessionId, links }: { sessionId: string; links: RecipientLink[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(token: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/t/${token}`);
    setCopied(token);
    setTimeout(() => setCopied((c) => (c === token ? null : c)), 2000);
  }

  return (
    <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
      {links.map((l) => (
        <li key={l.unitId} className="flex flex-wrap items-center gap-2 px-4 py-2">
          <span className="min-w-0 flex-1 font-medium">{l.label}</span>
          <button
            type="button"
            onClick={() => copy(l.token)}
            className="rounded-lg bg-navy px-3 py-1 text-sm font-semibold text-white"
          >
            {copied === l.token ? "Copied" : "Copy link"}
          </button>
          <a href={`/t/${l.token}`} target="_blank" rel="noreferrer" className="text-sm text-teal-800 underline">
            Open
          </a>
          <form
            action={newTrackLink}
            onSubmit={(e) => {
              if (!confirm(`Make a new link for ${l.label}? The old link will stop working.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="sessionId" value={sessionId} />
            <input type="hidden" name="unitId" value={l.unitId} />
            <button className="text-sm text-slate-600 underline">New link</button>
          </form>
        </li>
      ))}
    </ul>
  );
}
