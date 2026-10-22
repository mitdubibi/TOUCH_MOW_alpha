import { describe, expect, it } from "vitest";
import { parseDate, parseDeliveryList } from "./parseDeliveryList";

const HEADER = "Date,Session,Block,Unit,Postal Code,Meal Type,Remarks";

describe("parseDate", () => {
  it("reads DD/MM/YYYY and ISO", () => {
    expect(parseDate("15/10/2026")).toBe("2026-10-15");
    expect(parseDate("5-1-2026")).toBe("2026-01-05");
    expect(parseDate("2026-10-15")).toBe("2026-10-15");
  });

  it("rejects impossible dates", () => {
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("10/15/2026")).toBeNull();
    expect(parseDate("tomorrow")).toBeNull();
  });
});

describe("parseDeliveryList", () => {
  it("parses good rows and normalises them", () => {
    const csv = `﻿${HEADER}\n15/10/2026,lunch,Blk 518,5-123,640518,Soft,"Ring twice, then wait"\n\n`;
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
        mealType: "Soft",
        remarks: "Ring twice, then wait",
      },
    ]);
  });

  it("accepts columns in any order and case", () => {
    const csv = "remarks,MEAL TYPE,postal code,unit,block,session,date\n,Normal,640518,#02-01,518,Dinner,15/10/2026";
    expect(parseDeliveryList(csv).rows).toHaveLength(1);
  });

  it("reports missing columns", () => {
    const { rows, errors } = parseDeliveryList("Date,Session,Block\n15/10/2026,Lunch,518");
    expect(rows).toEqual([]);
    expect(errors[0].message).toContain("Unit, Postal Code, Meal Type, Remarks");
  });

  it("reports every problem on a row with its line number", () => {
    const csv = `${HEADER}\n15/10/2026,Lunch,518,#05-123,640518,Soft,\n32/10/2026,Brunch,518,ground,64051,,`;
    const { rows, errors } = parseDeliveryList(csv);
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(3);
    expect(errors[0].message).toMatch(/date.*session.*unit.*meal type/);
  });

  it("flags duplicate units and a postal code used for two blocks", () => {
    const csv = [
      HEADER,
      "15/10/2026,Lunch,518,#05-123,640518,Soft,",
      "15/10/2026,Lunch,518,05-123,640518,Normal,",
      "15/10/2026,Lunch,519,#02-001,640518,Normal,",
      "15/10/2026,Dinner,518,#05-123,640518,Soft,",
    ].join("\n");
    const { rows, errors } = parseDeliveryList(csv);
    expect(rows.map((r) => r.line)).toEqual([2, 5]);
    expect(errors.map((e) => e.line)).toEqual([3, 4]);
    expect(errors[0].message).toContain("already on line 2");
    expect(errors[1].message).toContain("is Blk 518");
  });
});
