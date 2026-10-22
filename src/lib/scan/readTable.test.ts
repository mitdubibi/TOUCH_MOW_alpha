import { describe, expect, it } from "vitest";
import { buildRows, findColumns, findDate, findSlot, readTable, rowsFromLines, type OcrWord } from "./readTable";

// A word as OCR returns it: text plus its box. Text is 30 px tall.
const w = (text: string, x0: number, y0: number, x1 = x0 + text.length * 15): OcrWord => ({ text, x0, y0, x1, y1: y0 + 30 });

// TOUCH's layout, made up: S/N, Special Instruction, Road, Block, Unit, Postal Code, L/D (header misread), Meal Type.
const header = [
  w("S/N", 0, 100),
  w("Special", 80, 100),
  w("Instruction", 200, 100),
  w("Road", 480, 100),
  w("Block", 700, 100),
  w("Unit", 850, 100),
  w("Postal", 1000, 85),
  w("Code", 1005, 115),
  w("wo", 1180, 100),
  w("Meal", 1300, 100),
  w("Type", 1380, 100),
];
const row = (y: number, sn: string, note: string, blk: string, unit: string, postal: string, meal: string) => [
  w(sn, 0, y),
  ...(note ? [w(note, 80, y)] : []),
  w("JURONG", 480, y),
  w("WEST", 590, y),
  w(blk, 700, y),
  w(unit, 850, y),
  w(postal, 1000, y),
  w("D", 1190, y),
  w(meal, 1330, y),
];
const body = [
  ...row(200, "1", "", "501", "#12-120", "640501", "H-BR"),
  ...row(280, "2", "Knock once", "501", "#03-110", "640501", "H"),
  w("then go.", 80, 315),
  ...row(380, "3", "", "518A", "#05-123", "640518", "HH"),
];

describe("findColumns", () => {
  it("finds each column and sets aside one whose heading OCR missed", () => {
    const found = findColumns({ words: [...header, ...body], lines: [] }, 1500)!;
    expect(found.headerBottom).toBeGreaterThan(145);
    expect(found.headerBottom).toBeLessThan(200);
    const at = (x: number) => found.columns.find((c) => x >= c.left && x < c.right)?.field;
    expect([at(100), at(500), at(710), at(860), at(1010), at(1195), at(1340)]).toEqual([
      "remarks",
      "other",
      "block",
      "unit",
      "postal",
      "other",
      "meal",
    ]);
  });

  it("gives up without a Block and Unit heading", () => {
    expect(findColumns({ words: body, lines: [] }, 1500)).toBeNull();
  });
});

describe("buildRows", () => {
  it("lines columns up into rows and keeps wrapped instructions with their row", () => {
    const pick = (x0: number, x1: number) => body.filter((b) => b.x0 >= x0 && b.x0 < x1);
    const rows = buildRows({
      remarks: pick(80, 480),
      block: pick(700, 850),
      unit: pick(850, 1000),
      postal: pick(1000, 1150),
      meal: pick(1300, 1500),
    });
    expect(rows).toEqual([
      { block: "501", unit: "#12-120", postalCode: "640501", mealType: "H-BR", remarks: "" },
      { block: "501", unit: "#03-110", postalCode: "640501", mealType: "H", remarks: "Knock once then go." },
      { block: "518A", unit: "#05-123", postalCode: "640518", mealType: "HH", remarks: "" },
    ]);
  });

  it("tidies OCR slips: missing dash, stray line bits, specks in empty cells", () => {
    const [r] = buildRows({
      block: [w("Blk 501", 0, 0)],
      unit: [w("#03110", 100, 0)],
      postal: [w("64O5O1", 200, 0)],
      remarks: [w("|", 300, 0), w("C13", 320, 0)],
    });
    expect(r).toEqual({ block: "501", unit: "#03-110", postalCode: "640501", mealType: "", remarks: "" });
  });
});

describe("findDate and findSlot", () => {
  const lines = [
    { text: "Meal Slot Dinner IMPORTANT", y0: 0, y1: 30 },
    { text: "Delivery Date Friday, 30 October, 2026", y0: 40, y1: 70 },
  ];
  it("reads TOUCH's written date and meal slot", () => {
    expect(findDate(lines)).toBe("2026-10-30");
    expect(findSlot(lines, [])).toBe("dinner");
  });
  it("falls back to the L/D column", () => {
    expect(findSlot([], [w("L", 0, 0), w("L", 0, 40), w("D", 0, 80)])).toBe("lunch");
    expect(findDate([{ text: "nothing here", y0: 0, y1: 1 }])).toBeNull();
  });
});

describe("rowsFromLines", () => {
  it("picks units out of whole lines when there is no header", () => {
    expect(rowsFromLines([{ text: "3 JURONG WEST ST 52 518 #05-123 640518 D H-BR NTU", y0: 0, y1: 30 }])).toEqual([
      { block: "518", unit: "#05-123", postalCode: "640518", mealType: "H-BR", remarks: "" },
    ]);
  });
});

describe("readTable", () => {
  it("reads the page, then each wanted column once", async () => {
    const calls: string[] = [];
    const result = await readTable(
      async ({ rect, mode, whitelist }) => {
        calls.push(`${mode}${whitelist ? `:${whitelist.slice(0, 3)}` : ""}`);
        const words = [...header, ...body].filter(
          (b) => !rect || (b.x0 >= rect.left && b.x0 < rect.left + rect.width && b.y0 >= rect.top),
        );
        return { words, lines: rect ? [] : [{ text: "Dinner 30/10/2026", y0: 0, y1: 30 }] };
      },
      { width: 1500, height: 500 },
    );
    expect(calls).toEqual(["sparse", "block", "block:012", "block:#01", "block:012", "block:ABC"]);
    expect(result.date).toBe("2026-10-30");
    expect(result.slot).toBe("dinner");
    expect(result.rows.map((r) => r.unit)).toEqual(["#12-120", "#03-110", "#05-123"]);
  });
});
