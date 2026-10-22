"use client";

import Papa from "papaparse";
import { REQUIRED_COLUMNS, parseDeliveryList, type ParseResult } from "@/lib/csv/parseDeliveryList";
import { MEAL_TYPES, mealLabel, parseMealType } from "@/lib/meals";
import type { ScannedRow } from "@/lib/scan/readTable";
import type { Slot } from "@/types/db";

export type ScanDraft = { fileName: string; date: string; slot: Slot | ""; rows: ScannedRow[] };

export const EMPTY_ROW: ScannedRow = { block: "", unit: "", postalCode: "", mealType: "", remarks: "" };

// The draft as a CSV in the standard columns, so it is checked and uploaded exactly like a CSV file. A missing date
// or session is filled with a stand-in for checking only; the form asks for it separately.
export function draftToCsv(draft: ScanDraft, forChecking = false): string {
  const date = draft.date || (forChecking ? "2000-01-01" : "");
  const slot = draft.slot || (forChecking ? "lunch" : "");
  return Papa.unparse({
    fields: [...REQUIRED_COLUMNS],
    data: draft.rows.map((r) => [date, slot, r.block, r.unit, r.postalCode, r.mealType, r.remarks]),
  });
}

export function checkDraft(draft: ScanDraft): ParseResult {
  return parseDeliveryList(draftToCsv(draft, true));
}

const input = "block w-full rounded-md border border-slate-400 px-2 py-2 text-base";

// Every row the scan found, editable. Problems show under the row they belong to (CSV line N is row N - 1).
export function ScanReview({ draft, onChange }: { draft: ScanDraft; onChange: (d: ScanDraft) => void }) {
  const { errors } = checkDraft(draft);
  const errorFor = (i: number) =>
    errors
      .filter((e) => e.line === i + 2)
      .map((e) => e.message.replace(/line (\d+)/g, (_, n) => `row ${Number(n) - 1}`))
      .join("; ");
  const setRow = (i: number, patch: Partial<ScannedRow>) =>
    onChange({ ...draft, rows: draft.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-amber-50 p-3 text-amber-900">
        Check every row against the paper list. The scan can misread numbers, so fix anything wrong before uploading.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="font-medium">Date</span>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => onChange({ ...draft, date: e.target.value })}
            className={`mt-1 ${input} ${draft.date ? "" : "border-red-500"}`}
          />
        </label>
        <label className="block">
          <span className="font-medium">Session</span>
          <select
            value={draft.slot}
            onChange={(e) => onChange({ ...draft, slot: e.target.value as Slot | "" })}
            className={`mt-1 ${input} bg-white ${draft.slot ? "" : "border-red-500"}`}
          >
            <option value="">Choose</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </select>
        </label>
      </div>

      <ol className="space-y-3">
        {draft.rows.map((r, i) => {
          const problem = errorFor(i);
          return (
            <li
              key={i}
              className={`space-y-2 rounded-lg border p-3 ${problem ? "border-red-400 bg-red-50" : "border-slate-300"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">Row {i + 1}</span>
                <button
                  type="button"
                  onClick={() => onChange({ ...draft, rows: draft.rows.filter((_, j) => j !== i) })}
                  className="text-sm text-red-700 underline"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="block text-sm">
                  Block
                  <input value={r.block} onChange={(e) => setRow(i, { block: e.target.value })} className={input} />
                </label>
                <label className="block text-sm">
                  Unit
                  <input value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} className={input} />
                </label>
                <label className="block text-sm">
                  Postal code
                  <input
                    inputMode="numeric"
                    value={r.postalCode}
                    onChange={(e) => setRow(i, { postalCode: e.target.value })}
                    className={input}
                  />
                </label>
              </div>
              <div className="grid grid-cols-[8.5rem_1fr] gap-2">
                <label className="block text-sm">
                  Meal type
                  <select
                    value={parseMealType(r.mealType) ?? ""}
                    onChange={(e) => setRow(i, { mealType: e.target.value })}
                    className={`${input} bg-white`}
                  >
                    <option value="">{r.mealType ? `"${r.mealType}"?` : "Choose"}</option>
                    {MEAL_TYPES.map((m) => (
                      <option key={m} value={m}>
                        {mealLabel(m)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  Instructions
                  <input value={r.remarks} onChange={(e) => setRow(i, { remarks: e.target.value })} className={input} />
                </label>
              </div>
              {problem && <p className="text-sm text-red-800">{problem}</p>}
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={() => onChange({ ...draft, rows: [...draft.rows, EMPTY_ROW] })}
        className="w-full rounded-lg border-2 border-dashed border-slate-400 py-3 font-medium text-slate-700"
      >
        Add a row
      </button>
    </div>
  );
}
