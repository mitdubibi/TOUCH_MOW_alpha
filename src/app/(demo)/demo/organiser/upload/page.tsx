"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DemoHeader } from "@/components/demo/ui";
import { CENTRE, sampleCsv, sampleCsvWithMistakes } from "@/data/mockData";
import { parseDeliveryList } from "@/lib/csv/parseDeliveryList";
import { formatDate, SLOT_LABEL, toDayMonthYear, todayInSingapore } from "@/lib/dates";
import { mealLabel } from "@/lib/meals";

export default function UploadDemo() {
  const date = toDayMonthYear(todayInSingapore());
  const [file, setFile] = useState({ name: "delivery-list-lunch.csv", text: sampleCsv(date) });
  const [uploaded, setUploaded] = useState(false);
  const result = useMemo(() => parseDeliveryList(file.text), [file.text]);

  const choose = (name: string, text: string) => {
    setFile({ name, text });
    setUploaded(false);
  };

  const sessions = new Map<string, { date: string; slot: "lunch" | "dinner"; units: number; blocks: Set<string> }>();
  for (const r of result.rows) {
    const key = `${r.date}${r.slot}`;
    const s = sessions.get(key) ?? { date: r.date, slot: r.slot, units: 0, blocks: new Set<string>() };
    s.units += 1;
    s.blocks.add(r.block);
    sessions.set(key, s);
  }
  const ok = result.errors.length === 0 && result.rows.length > 0;

  return (
    <>
      <DemoHeader title="Upload delivery list" subtitle={`For ${CENTRE.name}`} />
      <main className="flex-1 space-y-4 p-4">
        <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
          <button
            type="button"
            onClick={() => choose("delivery-list-lunch.csv", sampleCsv(date))}
            className="rounded-xl border-2 border-navy py-2 text-navy"
          >
            Sample list
          </button>
          <button
            type="button"
            onClick={() => choose("list-with-mistakes.csv", sampleCsvWithMistakes(date))}
            className="rounded-xl border-2 border-navy py-2 text-navy"
          >
            Sample with mistakes
          </button>
        </div>
        <label className="block rounded-xl border-2 border-dashed border-navy/30 p-4 text-center text-navy">
          <span className="font-semibold">📄 {file.name}</span>
          <span className="block text-sm text-slate-600">Tap to choose your own CSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) choose(f.name, await f.text());
            }}
          />
        </label>

        {result.errors.length > 0 && (
          <div role="alert" className="rounded-xl border-l-4 border-red-600 bg-red-50 p-3">
            <p className="font-semibold text-red-900">
              {result.errors.length} problem{result.errors.length > 1 ? "s" : ""} to fix before uploading
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-red-900">
              {result.errors.map((e, i) => (
                <li key={i}>
                  Line {e.line}: {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {[...sessions.values()].map((s) => (
          <div key={`${s.date}${s.slot}`} className="rounded-xl bg-navy p-3 text-white">
            <p className="font-semibold text-sun">
              {formatDate(s.date)} · {SLOT_LABEL[s.slot]}
            </p>
            <p className="text-sm">
              {s.units} meals in {s.blocks.size} blocks
            </p>
          </div>
        ))}

        {result.rows.length > 0 && (
          <div className="max-h-72 overflow-auto rounded-xl border border-navy/15">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-sun-light text-navy">
                <tr>
                  <th className="px-2 py-1.5">Blk</th>
                  <th className="px-2 py-1.5">Unit</th>
                  <th className="px-2 py-1.5">Meal</th>
                  <th className="px-2 py-1.5">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.line} className="border-t border-navy/10">
                    <td className="px-2 py-1.5 font-semibold">{r.block}</td>
                    <td className="px-2 py-1.5">{r.unit}</td>
                    <td className="px-2 py-1.5">{mealLabel(r.mealType)}</td>
                    <td className="px-2 py-1.5 text-slate-600">{r.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {uploaded ? (
          <div className="rounded-xl border-l-4 border-green-600 bg-green-50 p-3 text-green-900">
            <p className="font-semibold">List uploaded. Units already ticked are kept.</p>
            <Link href="/demo/organiser/assign" className="font-semibold underline">
              Next: assign blocks to volunteers
            </Link>
          </div>
        ) : (
          <button
            type="button"
            disabled={!ok}
            onClick={() => setUploaded(true)}
            className="w-full rounded-xl bg-sun py-3 text-lg font-bold text-navy disabled:opacity-40"
          >
            {ok ? `Upload ${result.rows.length} meals` : "Fix the problems first"}
          </button>
        )}
      </main>
    </>
  );
}
