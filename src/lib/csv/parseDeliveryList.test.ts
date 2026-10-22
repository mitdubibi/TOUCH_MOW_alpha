import { describe, expect, it } from "vitest";
import { parseDate, parseDeliveryList } from "./parseDeliveryList";

const HEADER = "Date,Session,Block,Unit,Postal Code,Meal Type,Remarks";

describe("parseDate", () => {
  it("reads DD/MM/YYYY and ISO", () => {
    expect(parseDate("15/10/2026")).toBe("2026-10-15");
    expect(parseDate("5-1-2026")).toBe("2026-01-05");
    expect(parseDate("2026-10-15")).toBe("2026-10-15");
  });

  it("reads written dates", () => {
    expect(parseDate("Wednesday, 30 September, 2026")).toBe("2026-09-30");
    expect(parseDate("30 Sep 2026")).toBe("2026-09-30");
    expect(parseDate("30-Sep-2026")).toBe("2026-09-30");
    expect(parseDate("30 Smarch 2026")).toBeNull();
  });

  it("rejects impossible dates", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("10/15/2026")).toBeNull();
    expect(parseDate("tomorrow")).toBeNull();
  });
});

describe("parseDeliveryList", () => {
  it("parses good rows and normalises them", () => {
    const csv = `﻿${HEADER}\n15/10/2026,lunch,Blk 518,5-123,640518,H-M,"Ring twice, then wait"\n\n`;
    const { rows, errors } = parseDeliveryList(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      {
        line: 2,
        date: "2026-10-15",
        slot: "lunch",
        block: "518",
        unit: "#05-123",
        floor: 5,
        postalCode: "640518",
        mealType: "H-M",
        remarks: "Ring twice, then wait",
      },
    ]);
  });

  it("accepts columns in any order and case", () => {
    const csv = "remarks,MEAL TYPE,postal code,unit,block,session,date\n,H-BR,640518,#02-01,518,Dinner,15/10/2026";
    expect(parseDeliveryList(csv).rows).toHaveLength(1);
  });

  it("reports missing columns", () => {
    const { rows, errors } = parseDeliveryList("Date,Session,Block\n15/10/2026,Lunch,518");
    expect(rows).toEqual([]);
    expect(errors[0].message).toContain("Unit, Postal Code, Meal Type, Remarks");
  });

  it("accepts only TOUCH's meal codes, plus the words normal and minced", () => {
    const csv = [
      HEADER,
      ...["normal", "hh", "H", "Minced", "HBR", "Soft"].map((m, i) => `15/10/2026,Lunch,518,#05-10${i},640518,${m},`),
    ].join("\n");
    const { rows, errors } = parseDeliveryList(csv);
    expect(rows.map((r) => r.mealType)).toEqual(["H-BR", "HH", "H", "H-M", "H-BR"]);
    expect(errors).toEqual([{ line: 7, message: 'meal type "Soft" should be H-BR, HH, H, H-M' }]);
  });

  it("reports every problem on a row with its line number", () => {
    const csv = `${HEADER}\n15/10/2026,Lunch,518,#05-123,640518,H-M,\n32/10/2026,Brunch,518,ground,64051,,`;
    const { rows, errors } = parseDeliveryList(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(3);
    expect(errors[0].message).toMatch(/date.*session.*unit.*meal type/);
  });

  it("reads TOUCH's own layout: details above the table, Special Instruction and L/D columns", () => {
    const csv = [
      "Meal Slot,,Dinner,,,,,,IMPORTANT",
      'Delivery Date,,"Friday, 30 October, 2026",,,,,,',
      "Centre,,Jurong West Kitchen (demo),,,,,,",
      "",
      "S/N,Special Instruction,Road,Block,Unit,Postal Code,L/D,Meal Type,Volunteer Name",
      "1,,JURONG WEST STREET 51,501,#03-110,640501,D,H-BR,NTU",
      '2,"Knock once, hang and go",JURONG WEST STREET 52,518A,#05-123,640518,,HH,NTU',
      "3,,JURONG WEST STREET 52,518A,#05-127,640518,L,H-M,NTU",
      ",,,,,,,,",
    ].join("\n");
    const { rows, errors } = parseDeliveryList(csv);
    expect(errors).toEqual([]);
    expect(rows.map((r) => [r.line, r.date, r.slot, r.block, r.unit, r.mealType, r.remarks])).toEqual([
      [6, "2026-10-30", "dinner", "501", "#03-110", "H-BR", ""],
      [7, "2026-10-30", "dinner", "518A", "#05-123", "HH", "Knock once, hang and go"],
      [8, "2026-10-30", "lunch", "518A", "#05-127", "H-M", ""],
    ]);
  });

  it("says what is missing when TOUCH's layout has no date", () => {
    const csv = "S/N,Special Instruction,Block,Unit,Postal Code,L/D,Meal Type\n1,,501,#03-110,640501,D,H-BR";
    expect(parseDeliveryList(csv).errors).toEqual([{ line: 1, message: "Missing column(s): Date" }]);
  });

  it("flags duplicate units and a postal code used for two blocks", () => {
    const csv = [
      HEADER,
      "15/10/2026,Lunch,518,#05-123,640518,H-M,",
      "15/10/2026,Lunch,518,05-123,640518,H-BR,",
      "15/10/2026,Lunch,519,#02-001,640518,H-BR,",
      "15/10/2026,Dinner,518,#05-123,640518,H-M,",
    ].join("\n");
    const { rows, errors } = parseDeliveryList(csv);
    expect(rows.map((r) => r.line)).toEqual([2, 5]);
    expect(errors.map((e) => e.line)).toEqual([3, 4]);
    expect(errors[0].message).toContain("already on line 2");
    expect(errors[1].message).toContain("is Blk 518");
  });
});
