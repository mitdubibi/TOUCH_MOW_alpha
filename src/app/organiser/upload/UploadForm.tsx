"use client";

import Link from "next/link";
import { useState } from "react";
import { parseDeliveryList, type ParseResult } from "@/lib/csv/parseDeliveryList";
import { formatDate, SLOT_LABEL } from "@/lib/dates";
import type { Centre, ImportSummary } from "@/types/db";

export function UploadForm({ centres }: { centres: Centre[] }) {
  const [centreId, setCentreId] = useState(centres[0]?.id ?? "");
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary[] | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setSummary(null);
    setServerError(null);
    if (!f) {
      setFile(null);
      setResult(null);
      return;
    }
    const text = await f.text();
    setFile({ name: f.name, text });
    setResult(parseDeliveryList(text));
  }

  async function onConfirm() {
    if (!file) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ centreId, fileName: file.name, csvText: file.text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      setSummary(body.sessions);
      setFile(null);
      setResult(null);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  // Preview: one line per session with unit and block counts.
  const sessions = new Map<string, { date: string; slot: "lunch" | "dinner"; units: number; blocks: Set<string> }>();
  for (const r of result?.rows ?? []) {
    const key = `${r.date}|${r.slot}`;
    const s = sessions.get(key) ?? { date: r.date, slot: r.slot, units: 0, blocks: new Set<string>() };
    s.units += 1;
    s.blocks.add(r.block);
    sessions.set(key, s);
  }
  const canConfirm = !!centreId && !!result && result.rows.length > 0 && result.errors.length === 0 && !submitting;

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="font-medium">Collection centre</span>
        <select
          value={centreId}
          onChange={(e) => setCentreId(e.target.value)}
          className="mt-1 block w-full rounded-lg border border-slate-400 bg-white px-3 py-3"
        >
          {centres.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="font-medium">CSV file</span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="mt-1 block w-full rounded-lg border border-slate-400 p-3"
        />
      </label>

      {result && result.errors.length > 0 && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4">
          <p className="font-semibold text-red-800">
            {result.errors.length} problem{result.errors.length > 1 ? "s" : ""} found. Fix the file and choose it
            again.
          </p>
          <ul className="mt-2 max-h-60 list-disc space-y-1 overflow-auto pl-5 text-sm text-red-900">
            {result.errors.map((e, i) => (
              <li key={i}>
                Line {e.line}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && result.rows.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Preview</h2>
          <ul className="space-y-1">
            {[...sessions.values()].map((s) => (
              <li key={`${s.date}${s.slot}`} className="rounded-lg bg-slate-100 px-3 py-2">
                {formatDate(s.date)} · {SLOT_LABEL[s.slot]}: {s.units} units in {s.blocks.size} blocks
              </li>
            ))}
          </ul>
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <th className="px-2 py-1">Blk</th>
                  <th className="px-2 py-1">Unit</th>
                  <th className="px-2 py-1">Meal</th>
                  <th className="px-2 py-1">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.line} className="border-t border-slate-200">
                    <td className="px-2 py-1">{r.block}</td>
                    <td className="px-2 py-1">{r.unit}</td>
                    <td className="px-2 py-1">{r.mealType}</td>
                    <td className="px-2 py-1 text-slate-600">{r.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {serverError && (
        <p role="alert" className="font-medium text-red-700">
          {serverError}
        </p>
      )}

      {result && (
        <button
          type="button"
          disabled={!canConfirm}
          onClick={onConfirm}
          className="w-full rounded-lg bg-teal-700 py-3 text-lg font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Uploading..." : `Upload ${result.rows.length} units`}
        </button>
      )}

      {summary && (
        <div className="rounded-lg border border-teal-300 bg-teal-50 p-4">
          <p className="font-semibold text-teal-900">List uploaded.</p>
          <ul className="mt-2 space-y-2">
            {summary.map((s) => (
              <li key={s.id}>
                <Link href={`/organiser/sessions/${s.id}`} className="font-medium underline">
                  {formatDate(s.date)} · {SLOT_LABEL[s.slot]}
                </Link>
                <span className="block text-sm text-slate-700">
                  {s.added} new, {s.updated} updated, {s.kept} already ticked (kept), {s.cancelled} removed
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
