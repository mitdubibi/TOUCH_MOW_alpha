import { describe, expect, it } from "vitest";
import { compareUnitsTopDown, parseBlock, parsePostalCode, parseUnit } from "./units";

describe("parseUnit", () => {
  it.each([
    ["#05-123", "#05-123", 5],
    ["05-123", "#05-123", 5],
    ["5-123", "#05-123", 5],
    ["# 12 - 34a", "#12-34A", 12],
  ])("%s -> %s", (raw, unit, floor) => {
    expect(parseUnit(raw)).toEqual({ unit, floor });
  });

  it.each(["", "123", "#00-12", "#99-12", "abc"])("rejects %j", (raw) => {
    expect(parseUnit(raw)).toBeNull();
  });
});

describe("parseBlock", () => {
  it("strips Blk and uppercases", () => {
    expect(parseBlock("Blk 518a")).toBe("518A");
    expect(parseBlock("518")).toBe("518");
    expect(parseBlock("Jurong")).toBeNull();
  });
});

describe("parsePostalCode", () => {
  it("pads 5 digits and rejects junk", () => {
    expect(parsePostalCode("640518")).toBe("640518");
    expect(parsePostalCode("18956")).toBe("018956");
    expect(parsePostalCode("6405")).toBeNull();
    expect(parsePostalCode("S640518")).toBeNull();
  });
});

describe("compareUnitsTopDown", () => {
  it("puts higher floors first, then unit number", () => {
    const units = [
      { floor: 3, unit_no: "#03-12" },
      { floor: 10, unit_no: "#10-9" },
      { floor: 3, unit_no: "#03-2" },
    ];
    expect(units.sort(compareUnitsTopDown).map((u) => u.unit_no)).toEqual(["#10-9", "#03-2", "#03-12"]);
  });
});
