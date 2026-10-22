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
  ["other", ["s/n", "sn", "sin", "s/no", "sno", "road", "volunteer", "name"]],
];
const headerField = (text: string) => {
  const key = text.toLowerCase().replace(/[^a-z/]/g, "");
  return HEADER_WORDS.find(([, words]) => words.includes(key))?.[0];
};

// Characters each column can hold. Stops Tesseract reading "V" as "Vv" or "0" as "O".
export const WHITELIST: Partial<Record<Field, string>> = {
  block: "0123456789ABCDEFGH",
  unit: "#0123456789-",
  postal: "0123456789",
  meal: "ABCDEFGHIJKLMNOPQRSTUVWXYZ-/",
  slot: "LDld",
};

const centreY = (w: OcrWord) => (w.y0 + w.y1) / 2;
const height = (w: OcrWord) => w.y1 - w.y0;
const medianOf = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

export type Columns = { headerBottom: number; columns: { field: Field; left: number; right: number }[] };

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

    const headerBottom = Math.max(...band.map((w) => w.y1)) + height(anchor) * 0.3;
    // Unnamed columns (S/N, Road, Volunteer Name) are kept as "other" so their text is not read as a neighbour's.
    const named = [...byField].map(([field, ws]) => ({ field, ws }));
    const others = band.filter((w) => headerField(w.text) === "other").map((w) => ({ field: "other" as Field, ws: [w] }));
    const centres = [...named, ...others]
      .map(({ field, ws }) => ({ field, x: (Math.min(...ws.map((w) => w.x0)) + Math.max(...ws.map((w) => w.x1))) / 2 }))
      .sort((a, b) => a.x - b.x)
      .filter((c, i, all) => i === 0 || c.field !== all[i - 1].field || c.field !== "other");

    // Leftover bits of table lines get read as flat "LLL" or "___"; real text is at least half a line tall.
    const below = page.words.filter((w) => w.y0 >= headerBottom && /[A-Za-z0-9]/.test(w.text));
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
    const columns = centres.map((c, i) => ({ field: c.field, left: i ? edges[i - 1] : 0, right: edges[i] ?? imageWidth }));

    // A column whose header OCR missed (L/D read as "wo") shows up as a wide empty strip inside its neighbour. The
    // part under the header keeps the field; the other part is set aside.
    const lineHeight = typical;
    const split = columns.flatMap((c) => {
      const centre = centres.find((x) => x.field === c.field && x.x >= c.left && x.x <= c.right)?.x ?? c.left;
      const textLeft = data.filter((w) => w.x0 >= c.left).reduce((m, w) => Math.min(m, w.x0), c.right);
      const textRight = data.filter((w) => w.x1 <= c.right).reduce((m, w) => Math.max(m, w.x1), c.left);
      const inner = gaps(textLeft, textRight).find((g) => g.end - g.start > lineHeight);
      if (!inner || c.field === "other" || c.field === "remarks") return [c];
      const at = (inner.start + inner.end) / 2;
      const parts = [
        { field: c.field, left: c.left, right: at },
        { field: c.field, left: at, right: c.right },
      ];
      return parts.map((p) => (centre >= p.left && centre < p.right ? p : { ...p, field: "other" as Field }));
    });
    return { headerBottom, columns: split };
  }
  return null;
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
  meal: (s: string) => keep(s, /[^A-Z/ -]/g).trim(),
  // Drops bits of table lines read as | [ ] and, when the S/N column was not found, its row number.
  // An empty cell often comes back as specks like "C13" or ". I", so text with no real word is dropped.
  remarks: (s: string, leftmost: boolean) => {
    const text = s
      .replace(/(^|\s)[|[\]{}_—-]+(?=\s|$)/g, " ")
      .replace(leftmost ? /^\s*\d{1,3}\b/ : /$^/, "")
      .replace(/\s+/g, " ")
      .trim();
    return /[A-Za-z]{3,}/.test(text) ? text : "";
  },
};

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

  return starts.map((start, i) => {
    const end = starts[i + 1] ?? Infinity;
    const text = (f: Field) =>
      (byField[f] ?? [])
        .filter((w) => centreY(w) >= start && centreY(w) < end)
        .map((w) => w.text)
        .join(" ");
    return {
      block: clean.block(text("block")),
      unit: clean.unit(text("unit")),
      postalCode: clean.postal(text("postal")),
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

  const wanted = found.columns.filter((c) => c.field !== "other");
  const byField: Partial<Record<Field, OcrWord[]>> = {};
  for (const [i, c] of wanted.entries()) {
    onStep?.(i + 1, wanted.length);
    const rect = {
      left: Math.max(0, Math.floor(c.left)),
      top: Math.floor(found.headerBottom),
      width: Math.max(1, Math.floor(c.right - c.left)),
      height: Math.max(1, Math.floor(size.height - found.headerBottom)),
    };
    byField[c.field] = (await ocr({ rect, mode: "block", whitelist: WHITELIST[c.field] })).words;
  }

  const above = page.lines.filter((l) => l.y1 <= found.headerBottom);
  return {
    date: findDate(above) ?? findDate(page.lines),
    slot: findSlot(above, byField.slot ?? []),
    rows: buildRows(byField, found.columns[0].field === "remarks"),
    foundHeader: true,
  };
}
