import Papa from "papaparse";
import type { Slot } from "../../types/db";
import { MEAL_TYPES, parseMealType, type MealType } from "../meals";
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

type Column = (typeof REQUIRED_COLUMNS)[number];

// Other names for the same column. TOUCH's own sheet says "Special Instruction" and "L/D" (Lunch or Dinner), and puts
// Meal Slot and Delivery Date in a few lines above the table instead of on every row.
const ALIASES: Record<Column, string[]> = {
  Date: ["date", "delivery date"],
  Session: ["session", "meal slot", "l/d"],
  Block: ["block", "blk"],
  Unit: ["unit"],
  "Postal Code": ["postal code"],
  "Meal Type": ["meal type"],
  Remarks: ["remarks", "special instruction", "special instructions"],
};
const FROM_TOP = ["Date", "Session"] as const;

export type DeliveryRow = {
  line: number;
  date: string; // YYYY-MM-DD
  slot: Slot;
  block: string;
  unit: string; // "#05-123"
  floor: number;
  postalCode: string;
  mealType: MealType;
  remarks: string;
};

export type RowError = { line: number; message: string };

export type ParseResult = { rows: DeliveryRow[]; errors: RowError[] };

const columnKey = (s: string) => s.replace(/^﻿/, "").trim().toLowerCase().replace(/\s+/g, " ");

const pad2 = (n: number) => String(n).padStart(2, "0");

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Accepts DD/MM/YYYY (also with - or .), YYYY-MM-DD and written dates like "Wednesday, 30 September, 2026" or
// "30-Sep-2026". Returns YYYY-MM-DD.
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (match) {
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else if ((match = s.match(/^(?:[a-z]+,?\s+)?(\d{1,2})[\s,.-]+([a-z]{3,})[\s,.-]+(\d{4})$/i))) {
    const month = MONTHS.indexOf(match[2].slice(0, 3).toLowerCase());
    if (month < 0) return null;
    [d, m, y] = [Number(match[1]), month + 1, Number(match[3])];
  } else {
    return null;
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

// "Lunch", "Dinner", or L / D from TOUCH's L/D column.
export function parseSlot(raw: string): Slot | null {
  const s = raw.trim().toLowerCase();
  if (s === "lunch" || s === "l") return "lunch";
  if (s === "dinner" || s === "d") return "dinner";
  return null;
}

// Parses and checks a delivery list. Line numbers match the spreadsheet (first line is 1).
// The header is the first line with Block, Unit and Postal Code. Lines above it may hold "Meal Slot" and
// "Delivery Date" with the value in a later cell, used for any row without its own.
export function parseDeliveryList(csvText: string): ParseResult {
  const parsed = Papa.parse<string[]>(csvText.replace(/^﻿/, ""), { header: false });
  const lines = parsed.data;

  const headerIndex = lines.findIndex((cells) => {
    const keys = cells.map(columnKey);
    return (["Block", "Unit", "Postal Code"] as const).every((c) => ALIASES[c].some((a) => keys.includes(a)));
  });
  const header = (lines[Math.max(headerIndex, 0)] ?? []).map(columnKey);
  const position = (c: Column) => header.findIndex((h) => ALIASES[c].includes(h));

  const fromTop: Partial<Record<Column, string>> = {};
  for (const cells of lines.slice(0, Math.max(headerIndex, 0))) {
    const at = cells.findIndex((cell) => FROM_TOP.some((c) => ALIASES[c].includes(columnKey(cell))));
    if (at < 0) continue;
    const column = FROM_TOP.find((c) => ALIASES[c].includes(columnKey(cells[at])))!;
    fromTop[column] ??= cells.slice(at + 1).find((cell) => cell.trim() !== "")?.trim();
  }

  const missing = REQUIRED_COLUMNS.filter((c) => position(c) < 0 && fromTop[c] === undefined);
  if (headerIndex < 0 || missing.length) {
    return {
      rows: [],
      errors: [{ line: headerIndex + 1 || 1, message: `Missing column(s): ${missing.join(", ")}` }],
    };
  }

  const rows: DeliveryRow[] = [];
  const errors: RowError[] = [];
  const firstLineOf = new Map<string, number>();
  const blockOfPostal = new Map<string, string>();
  const ROW_COLUMNS = REQUIRED_COLUMNS.filter((c) => position(c) >= 0);

  lines.slice(headerIndex + 1).forEach((cells, i) => {
    const line = headerIndex + i + 2;
    const cell = (c: Column) => (position(c) >= 0 ? (cells[position(c)] ?? "").trim() : "");
    if (ROW_COLUMNS.every((c) => cell(c) === "")) return;
    const get = (c: Column) => cell(c) || fromTop[c] || "";

    if (cells.slice(header.length).some((extra) => extra.trim() !== "")) {
      errors.push({ line, message: `Too many fields: expected ${header.length} fields but parsed ${cells.length}` });
    }

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
    const mealType = parseMealType(get("Meal Type"));
    if (!mealType) {
      problems.push(
        get("Meal Type")
          ? `meal type "${get("Meal Type")}" should be ${MEAL_TYPES.join(", ")}`
          : "meal type is empty",
      );
    }

    if (problems.length || !date || !slot || !block || !unit || !postalCode || !mealType) {
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
      remarks: cell("Remarks"),
    });
  });

  for (const e of parsed.errors) {
    errors.push({ line: (e.row ?? 0) + 1, message: e.message });
  }
  errors.sort((a, b) => a.line - b.line);

  return { rows, errors };
}
