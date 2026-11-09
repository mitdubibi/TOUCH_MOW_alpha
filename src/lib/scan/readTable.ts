// Reads a delivery list table out of OCR words. Pure (no Tesseract here), so it can be tested; scanList.ts runs the
// OCR. The organiser checks and fixes every row before upload, so this aims for "mostly right", not perfect.
import type { Slot } from "../../types/db";
import { parseDate, parseSlot } from "../csv/parseDeliveryList";

export type OcrWord = { text: string; x0: number; y0: number; x1: number; y1: number };
export type OcrLine = { text: string; y0: number; y1: number };
export type OcrResult = { words: OcrWord[]; lines: OcrLine[] };
export type Rect = { left: number; top: number; width: number; height: number };

// Field read from one column of the table. "other" columns only help find where their neighbours start and end.
export type Field = "remarks" | "block" | "unit" | "postal" | "meal" | "slot" | "other";

export type ScannedRow = { block: string; unit: string; postalCode: string; mealType: string; remarks: string };
export type ScanResult = { date: string | null; slot: Slot | null; rows: ScannedRow[]; foundHeader: boolean };

// Header words, after lower-casing and dropping everything but letters and "/". Includes common OCR misreads.
const HEADER_WORDS: [Field, string[]][] = [
  ["remarks", ["special", "instruction", "instructions", "remarks", "remark"]],
  ["block", ["block", "blk"]],
  ["unit", ["unit", "uni"]],
  ["postal", ["postal", "code"]],
  ["meal", ["meal", "type"]],
  ["slot", ["l/d", "ld", "lud", "l/o", "lid", "ud", "u/d", "i/d", "/d", "session"]],
  ["other", ["s/n", "sn", "sin", "s/no", "sno", "road", "volunteer", "name", "gender"]],
];
const headerField = (text: string) => {
  const key = text.toLowerCase().replace(/[^a-z/]/g, "");
  return HEADER_WORDS.find(([, words]) => words.includes(key))?.[0];
};

// Characters a strip can hold. Stops Tesseract reading "H" as "Hh" in the meal column.
export const WHITELIST: Partial<Record<Field, string>> = {
  meal: "ABCDEFGHIJKLMNOPQRSTUVWXYZ-/",
};

const centreY = (w: OcrWord) => (w.y0 + w.y1) / 2;
const height = (w: OcrWord) => w.y1 - w.y0;
const medianOf = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

export type Columns = {
  headerBottom: number;
  columns: { field: Field; centre: number; left: number; right: number }[];
};

// Finds the header line (the one with Block and Unit) and where each column starts and ends. Column edges are the
// widest gap in the data between two header centres, since OCR words never cross a column line.
export function findColumns(page: OcrResult, imageWidth: number): Columns | null {
  for (const anchor of page.words.filter((w) => headerField(w.text) === "block")) {
    // Two-line headers ("Postal / Code") sit up to about one line above or below the anchor.
    const band = page.words.filter(
      (w) => headerField(w.text) && Math.abs(centreY(w) - centreY(anchor)) < 1.5 * height(anchor),
    );
    const byField = new Map<Field, OcrWord[]>();
    for (const w of band) {
      const field = headerField(w.text)!;
      if (field !== "other") byField.set(field, [...(byField.get(field) ?? []), w]);
    }
    if (!byField.has("unit")) continue;

    // The first row can touch the heading bar, so rows are told apart from headings by their middle, not their top.
    const headerBottom = Math.max(...band.map((w) => w.y1)) + 1;
    // Unnamed columns (S/N, Road, Volunteer Name) are kept as "other" so their text is not read as a neighbour's.
    const named = [...byField].map(([field, ws]) => ({ field, ws }));
    const others = band.filter((w) => headerField(w.text) === "other").map((w) => ({ field: "other" as Field, ws: [w] }));
    const centres = [...named, ...others]
      .map(({ field, ws }) => ({ field, x: (Math.min(...ws.map((w) => w.x0)) + Math.max(...ws.map((w) => w.x1))) / 2 }))
      .sort((a, b) => a.x - b.x)
      .filter((c, i, all) => i === 0 || c.field !== all[i - 1].field || c.field !== "other");

    // Leftover bits of table lines get read as flat "LLL" or "___"; real text is at least half a line tall.
    const below = page.words.filter((w) => centreY(w) >= headerBottom && /[A-Za-z0-9]/.test(w.text));
    const typical = medianOf(below.map(height));
    const data = below.filter((w) => height(w) >= typical * 0.5);
    const covered = new Uint8Array(Math.ceil(imageWidth) + 2);
    for (const w of data) {
      for (let x = Math.max(0, Math.floor(w.x0)); x <= Math.min(imageWidth, Math.ceil(w.x1)); x++) covered[x] = 1;
    }
    // Empty strips (no word in any row) between a and b, widest first.
    const gaps = (a: number, b: number) => {
      const found: { start: number; end: number }[] = [];
      let start = -1;
      for (let x = Math.max(0, Math.ceil(a)); x <= Math.floor(b) + 1; x++) {
        const free = x <= b && covered[x] === 0;
        if (free && start < 0) start = x;
        if (!free && start >= 0) {
          found.push({ start, end: x });
          start = -1;
        }
      }
      return found.sort((p, q) => q.end - q.start - (p.end - p.start));
    };
    const edgeBetween = (a: number, b: number) => {
      const widest = gaps(a, b)[0];
      return widest ? (widest.start + widest.end) / 2 : (a + b) / 2;
    };

    const edges = centres.slice(1).map((c, i) => edgeBetween(centres[i].x, c.x));
    const columns = centres.map((c, i) => ({
      field: c.field,
      centre: c.x,
      left: i ? edges[i - 1] : 0,
      right: edges[i] ?? imageWidth,
    }));
    return { headerBottom, columns };
  }
  return null;
}

// Strips specks OCR glues onto a word ("|501", "640501,").
const bare = (s: string) => s.replace(/^[|[\]{}'"‘’`,.:;]+|[|[\]{}'"‘’`,.:;]+$/g, "");

// Block, unit and postal code each have a clear shape, so they are picked out of the whole-page read by shape. The
// header positions only decide which short number is the block (not the S/N or the street number).
export function pickByShape(page: OcrResult, found: Columns): Partial<Record<Field, OcrWord[]>> {
  const data = page.words
    .filter((w) => centreY(w) >= found.headerBottom)
    .map((w) => ({ ...w, text: bare(w.text) }));
  // A word belongs under a heading when it is nearer to that heading than to the next one along.
  const under = (f: Field) => {
    const own = found.columns.find((c) => c.field === f);
    if (!own) return () => f !== "block";
    const gap = Math.min(...found.columns.filter((c) => c !== own).map((c) => Math.abs(c.centre - own.centre)));
    return (w: OcrWord) => Math.abs((w.x0 + w.x1) / 2 - own.centre) <= gap * 0.6;
  };
  const [inBlock, inUnit, inPostal] = [under("block"), under("unit"), under("postal")];

  const unit = data.filter((w) => /[#-]/.test(w.text) && /^#?\d{1,2}-?\d{2,5}[A-Z]?$/i.test(digits(w.text)) && inUnit(w));
  const postal = data.filter((w) => /^\d{6}$/.test(digits(w.text)) && inPostal(w));
  const block = data.filter((w) => /^\d{1,4}[A-H]?$/i.test(w.text) && inBlock(w));
  return { unit, postal, block };
}

const keep = (s: string, allowed: RegExp) => s.toUpperCase().replace(allowed, "");
// Letters OCR confuses with digits, for fields that are all digits.
const digits = (s: string) => s.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1");
const clean = {
  block: (s: string) => keep(s, /[^0-9A-Z]/g).replace(/^BLK/, ""),
  unit: (s: string) => {
    const m = digits(s.replace(/\s/g, "")).match(/(\d{1,2})-?(\d{2,5}[A-Z]?)$/i);
    return m ? `#${m[1].padStart(2, "0")}-${m[2]}` : s.trim();
  },
  postal: (s: string) => digits(s).replace(/\D/g, ""),
  // The meal strip also takes in the L/D letter before it and the volunteer name after it ("D HBRNTU"), so the code
  // is read from the start of the first word with an H. B is often read as E or 8. Unknown text is kept to fix by hand.
  meal: (s: string) => {
    const text = keep(s, /[^A-Z0-9/ -]/g).trim();
    for (const word of text.split(/\s+/)) {
      const m = word.replace(/^[DL](?=H)/, "").match(/^[^H]?H(-?[BE8]R|-?M|H)?/);
      if (m) return { "": "H", H: "HH", M: "H-M" }[(m[1] ?? "").replace("-", "")] ?? "H-BR";
    }
    // A code glued to the next column's text ("VJURONG"): keep just the code letter.
    return /^[A-Z][A-Z]{4,}$/.test(text) ? text[0] : text;
  },
  // Drops bits of table lines read as | [ ] and, when the S/N column was not found, its row number.
  // An empty cell often comes back as specks like "C13" or ". I", so text with no real word is dropped.
  remarks: (s: string, leftmost: boolean) => {
    const text = s
      .replace(/(^|\s)[|[\]{}_—-]+(?=\s|$)/g, " ")
      .replace(/(^|\s)[|[\]{}]+(?=\S)/g, "$1")
      .replace(leftmost ? /^\s*\d{1,3}\b/ : /$^/, "")
      .replace(/\s+/g, " ")
      .trim();
    return /[A-Za-z]{3,}/.test(text) ? text : "";
  },
};

// Meal Type heading not read: the column is wherever the meal codes are (H-BR, HH, H-M).
export function mealByCodes(page: OcrResult, found: Columns): { left: number; right: number } | null {
  const codes = page.words.filter(
    (w) => centreY(w) >= found.headerBottom && /^H(-?[BE8]R|-?M|H)$/.test(bare(w.text).toUpperCase()),
  );
  if (codes.length < 2) return null;
  const lineHeight = medianOf(codes.map(height));
  const middle = medianOf(codes.map((w) => (w.x0 + w.x1) / 2));
  const near = codes.filter((w) => Math.abs((w.x0 + w.x1) / 2 - middle) < lineHeight * 3);
  // Little margin: the next column (Road in some sheets) starts right after.
  return {
    left: Math.min(...near.map((w) => w.x0)) - lineHeight * 0.3,
    right: Math.max(...near.map((w) => w.x1)) + lineHeight * 0.3,
  };
}

// Special Instruction heading not read: in TOUCH's sheet it is the wide column after S/N, so take everything from
// the end of the row numbers to the next column found.
export function remarksByPosition(page: OcrResult, found: Columns): { left: number; right: number } | null {
  const first = found.columns[0];
  if (!first || first.field !== "other" || found.columns.length < 2) return null;
  const numbers = page.words.filter(
    (w) => centreY(w) >= found.headerBottom && w.x1 < first.right && /^\d{1,3}$/.test(bare(w.text)),
  );
  const sn = numbers.filter((w) => Math.abs((w.x0 + w.x1) / 2 - first.centre) < height(w) * 2);
  if (!sn.length) return null;
  const left = Math.max(...sn.map((w) => w.x1)) + 2;
  return first.right - left > height(sn[0]) * 4 ? { left, right: first.right } : null;
}

// HDB postal codes end in the block number (Blk 459 is 640459), so a cell border read as an extra first digit
// ("1459") is dropped when the rest matches.
export function blockMatchingPostal(block: string, postal: string): string {
  const m = block.match(/^\d(\d{3}[A-Z]?)$/);
  return m && /^\d{6}$/.test(postal) && postal.endsWith(m[1].slice(0, 3)) ? m[1] : block;
}

// Lines up the column reads into rows. A row starts at each line with a block, unit or postal code; everything below
// it (wrapped instructions) belongs to it until the next one.
export function buildRows(byField: Partial<Record<Field, OcrWord[]>>, remarksLeftmost = false): ScannedRow[] {
  const anchors = (["block", "unit", "postal"] as const)
    .flatMap((f) => byField[f] ?? [])
    .filter((w) => /\d/.test(w.text))
    .sort((a, b) => centreY(a) - centreY(b));
  if (!anchors.length) return [];
  const lineHeight = medianOf(anchors.map(height));

  const tops: number[] = [];
  for (const w of anchors) {
    if (!tops.length || centreY(w) - tops[tops.length - 1] > lineHeight * 0.6) tops.push(centreY(w));
  }
  const starts = tops.map((t) => t - lineHeight * 0.8);

  // Block, unit and postal code sit on a row's first line, so each goes to the nearest one. Instructions and meal
  // codes can wrap, so they take everything down to the next row.
  const nearestRow = (w: OcrWord) =>
    tops.reduce((best, t, i) => (Math.abs(centreY(w) - t) < Math.abs(centreY(w) - tops[best]) ? i : best), 0);
  return starts.map((start, i) => {
    const end = starts[i + 1] ?? Infinity;
    const text = (f: Field) =>
      (byField[f] ?? [])
        .filter((w) =>
          f === "block" || f === "unit" || f === "postal"
            ? nearestRow(w) === i
            : centreY(w) >= start && centreY(w) < end,
        )
        .map((w) => w.text)
        .join(" ");
    const postalCode = clean.postal(text("postal"));
    return {
      block: blockMatchingPostal(clean.block(text("block")), postalCode),
      unit: clean.unit(text("unit")),
      postalCode,
      mealType: clean.meal(text("meal")),
      remarks: clean.remarks(text("remarks"), remarksLeftmost),
    };
  });
}

// "Delivery Date ... Friday, 30 October, 2026" or "30/10/2026" anywhere in the lines.
export function findDate(lines: OcrLine[]): string | null {
  for (const { text } of lines) {
    const written = text.match(/(\d{1,2})[\s,.-]+([A-Za-z]{3,})[\s,.-]+(\d{4})/);
    const date = written ? parseDate(written.slice(1).join(" ")) : null;
    if (date) return date;
    const numeric = text.match(/\b(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})\b/);
    if (numeric && parseDate(numeric[1])) return parseDate(numeric[1]);
  }
  return null;
}

// "Meal Slot  Dinner" above the table, else the most common letter in the L/D column.
export function findSlot(lines: OcrLine[], slotWords: OcrWord[]): Slot | null {
  for (const { text } of lines) {
    const m = text.match(/\b(lunch|dinner)\b/i);
    if (m) return parseSlot(m[1]);
  }
  const votes = slotWords.map((w) => parseSlot(w.text)).filter((s): s is Slot => !!s);
  if (!votes.length) return null;
  return votes.filter((s) => s === "dinner").length * 2 >= votes.length ? "dinner" : "lunch";
}

// No header found (cropped photo, or a different layout): pick units, blocks and postal codes out of each line.
export function rowsFromLines(lines: OcrLine[]): ScannedRow[] {
  const rows: ScannedRow[] = [];
  for (const { text } of lines) {
    // "#05-123", "05-123", or "#05123" when OCR drops the dash.
    const unit = text.match(/(?:#\s?(\d{1,2})-?|\b(\d{1,2})-)(\d{2,5}[A-Z]?)\b/i);
    if (!unit) continue;
    const before = text.slice(0, unit.index);
    const after = text.slice((unit.index ?? 0) + unit[0].length);
    const postal = after.match(/\b(\d{6})\b/);
    const afterPostal = postal ? after.slice((postal.index ?? 0) + 6).trim().split(/\s+/) : [];
    rows.push({
      block: before.match(/(\d{1,4}[A-H]?)\W*$/i)?.[1].toUpperCase() ?? "",
      unit: clean.unit(`${unit[1] ?? unit[2]}-${unit[3]}`),
      postalCode: postal?.[1] ?? "",
      mealType: clean.meal(afterPostal.find((t) => !/^[LD]$/i.test(t)) ?? ""),
      remarks: "",
    });
  }
  return rows;
}

// Runs the whole read. ocr() reads the (already cleaned) image, or one rectangle of it with a page mode and the
// characters allowed.
export async function readTable(
  ocr: (opts: { rect?: Rect; mode: "sparse" | "block"; whitelist?: string }) => Promise<OcrResult>,
  size: { width: number; height: number },
  onStep?: (done: number, total: number) => void,
): Promise<ScanResult> {
  const page = await ocr({ mode: "sparse" });
  const found = findColumns(page, size.width);
  if (!found) {
    return { date: findDate(page.lines), slot: findSlot(page.lines, []), rows: rowsFromLines(page.lines), foundHeader: false };
  }
  const byField = pickByShape(page, found);

  // Meal codes ("H", "HH") and instructions are read again from their own strip: the whole-page read skips lone
  // letters and mixes up wrapped lines. When the meal column comes straight after Postal Code (L/D heading not
  // read), the strip starts after the postal codes and may take in the L/D letter, which clean.meal drops.
  const column = (f: Field) => found.columns.find((c) => c.field === f);
  const strips: { field: Field; left: number; right: number }[] = [];
  const remarks = column("remarks") ?? remarksByPosition(page, found);
  if (remarks) strips.push({ field: "remarks", left: remarks.left, right: remarks.right });
  const meal = column("meal");
  if (meal) {
    const before = found.columns[found.columns.indexOf(meal) - 1];
    const postalRight = Math.max(0, ...(byField.postal ?? []).map((w) => w.x1));
    const left = before?.field === "postal" ? Math.max(meal.left, postalRight + 2) : meal.left;
    strips.push({ field: "meal", left, right: meal.right });
  } else {
    const byCodes = mealByCodes(page, found);
    if (byCodes) strips.push({ field: "meal", ...byCodes });
  }

  for (const [i, s] of strips.entries()) {
    onStep?.(i + 1, strips.length);
    const rect = {
      left: Math.max(0, Math.floor(s.left)),
      top: Math.floor(found.headerBottom),
      width: Math.max(1, Math.floor(s.right - s.left)),
      height: Math.max(1, Math.floor(size.height - found.headerBottom)),
    };
    byField[s.field] = (await ocr({ rect, mode: "block", whitelist: WHITELIST[s.field] })).words;
  }

  const above = page.lines.filter((l) => l.y1 <= found.headerBottom);
  const slotLetters = (byField.meal ?? []).filter((w) => /^[DL]$/i.test(w.text));
  return {
    date: findDate(above) ?? findDate(page.lines),
    slot: findSlot(above, slotLetters),
    rows: buildRows(byField, found.columns[0].field === "remarks"),
    foundHeader: true,
  };
}
