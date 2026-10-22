import { describe, expect, it } from "vitest";
import type { ChecklistItem } from "../types/db";
import { groupByBlock, progress } from "./checklist";

const item = (id: string, block_no: string, unit_no: string, floor: number): ChecklistItem => ({
  id,
  status: "pending",
  meal_type: "H-BR",
  remarks: null,
  done_at: null,
  photo_requested_at: null,
  photo_request_note: null,
  photo_path: null,
  problems: [],
  unit_no,
  floor,
  postal_code: `640${block_no.padStart(3, "0")}`,
  block_no,
});

describe("groupByBlock", () => {
  it("groups by block in number order with top floors first", () => {
    const groups = groupByBlock([
      item("a", "652", "#02-10", 2),
      item("b", "518", "#03-01", 3),
      item("c", "652", "#11-10", 11),
      item("d", "52", "#01-01", 1),
    ]);
    expect(groups.map((g) => g.blockNo)).toEqual(["52", "518", "652"]);
    expect(groups[2].items.map((i) => i.id)).toEqual(["c", "a"]);
  });

  it("follows the route order, then the rest by block number", () => {
    const groups = groupByBlock(
      [
        item("a", "652", "#02-10", 2),
        item("b", "518", "#03-01", 3),
        item("c", "601", "#11-10", 11),
        item("d", "52", "#01-01", 1),
        item("e", "501", "#01-01", 1),
      ],
      ["640652", "640518"],
    );
    expect(groups.map((g) => g.blockNo)).toEqual(["652", "518", "52", "501", "601"]);
  });
});

describe("progress", () => {
  it("ignores cancelled units", () => {
    expect(progress(["delivered", "not_home", "pending", "cancelled"])).toEqual({ done: 2, total: 3 });
  });
});
