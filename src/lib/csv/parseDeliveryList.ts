import Papa from "papaparse";
import type { Slot } from "../../types/db";
import { parseBlock, parsePostalCode, parseUnit } from "../units";

export const REQUIRED_COLUMNS = [
  "Date",
  "Session",
  "Block",
  "Unit",
  "Postal Code",
  "Meal Type",
  "Remarks",
] as const;

export type DeliveryRow = {
  line: number;
  date: string; // YYYY-MM-DD
  slot: Slot;
  block: string;
  unit: string; // "#05-123"
  floor: number;
  postalCode: string;
  mealType: string;
  remarks: string;
};

export type RowError = { line: number; message: string };

export type ParseResult = { rows: DeliveryRow[]; errors: RowError[] };

const columnKey = (s: string) => s.replace(/^﻿/, "").trim().toLowerCase().replace(/\s+/g, " ");

const pad2 = (n: number) => String(n).padStart(2, "0");

// Accepts DD/MM/YYYY (also with - or .) and YYYY-MM-DD. Returns YYYY-MM-DD.
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    return null;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function parseSlot(raw: string): Slot | null {
  const s = raw.trim().toLowerCase();
  return s === "lunch" || s === "dinner" ? s : null;
}

// Parses and checks a delivery list. Line numbers match the spreadsheet (header is line 1).
export function parseDeliveryList(csvText: string): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(csvText.replace(/^﻿/, ""), {
    header: true,
    transformHeader: columnKey,
  });

  const headers = parsed.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(columnKey(c)));
  if (missing.length) {
    return { rows: [], errors: [{ line: 1, message: `Missing column(s): ${missing.join(", ")}` }] };
  }

  const rows: DeliveryRow[] = [];
  const errors: RowError[] = [];
  const firstLineOf = new Map<string, number>();
  const blockOfPostal = new Map<string, string>();

  parsed.data.forEach((record, i) => {
    const line = i + 2;
    const get = (c: string) => (record[columnKey(c)] ?? "").trim();
    if (REQUIRED_COLUMNS.every((c) => get(c) === "")) return;

    const problems: string[] = [];
    const date = parseDate(get("Date"));
    if (!date) problems.push(`date "${get("Date")}" should look like 15/10/2026`);
    const slot = parseSlot(get("Session"));
    if (!slot) problems.push(`session "${get("Session")}" should be Lunch or Dinner`);
    const block = parseBlock(get("Block"));
    if (!block) problems.push(`block "${get("Block")}" is not a block number`);
    const unit = parseUnit(get("Unit"));
    if (!unit) problems.push(`unit "${get("Unit")}" should look like #05-123`);
    const postalCode = parsePostalCode(get("Postal Code"));
    if (!postalCode) problems.push(`postal code "${get("Postal Code")}" should be 6 digits`);
    const mealType = get("Meal Type");
    if (!mealType) problems.push("meal type is empty");

    if (problems.length || !date || !slot || !block || !unit || !postalCode) {
      errors.push({ line, message: problems.join("; ") });
      return;
    }

    const knownBlock = blockOfPostal.get(postalCode);
    if (knownBlock && knownBlock !== block) {
      errors.push({
        line,
        message: `postal code ${postalCode} is Blk ${knownBlock} on an earlier line, not Blk ${block}`,
      });
      return;
    }
    blockOfPostal.set(postalCode, block);

    const dupKey = [date, slot, postalCode, unit.unit].join("|");
    const firstLine = firstLineOf.get(dupKey);
    if (firstLine) {
      errors.push({ line, message: `${unit.unit} at Blk ${block} is already on line ${firstLine}` });
      return;
    }
    firstLineOf.set(dupKey, line);

    rows.push({
      line,
      date,
      slot,
      block,
      unit: unit.unit,
      floor: unit.floor,
      postalCode,
      mealType,
      remarks: get("Remarks"),
    });
  });

  // Missing trailing fields are already reported above; extra fields usually mean an unquoted comma.
  for (const e of parsed.errors) {
    if (e.code === "TooFewFields") continue;
    errors.push({ line: (e.row ?? 0) + 2, message: e.message });
  }
  errors.sort((a, b) => a.line - b.line);

  return { rows, errors };
}
