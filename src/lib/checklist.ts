import type { ChecklistItem, DeliveryStatus } from "../types/db";
import { compareBlockNumbers, compareUnitsTopDown } from "./units";

export type BlockGroup = {
  postalCode: string;
  blockNo: string;
  items: ChecklistItem[];
};

export const isDone = (status: DeliveryStatus) =>
  status === "delivered" || status === "not_home" || status === "skipped";

// Units grouped by block, units top floor first. Blocks follow routeOrder (postal codes in walking
// order); blocks not in it, or every block when there is no route, go after in block number order.
export function groupByBlock(items: ChecklistItem[], routeOrder?: string[]): BlockGroup[] {
  const groups = new Map<string, BlockGroup>();
  for (const item of items) {
    let g = groups.get(item.postal_code);
    if (!g) {
      g = { postalCode: item.postal_code, blockNo: item.block_no, items: [] };
      groups.set(item.postal_code, g);
    }
    g.items.push(item);
  }
  const result = [...groups.values()];
  for (const g of result) g.items.sort(compareUnitsTopDown);
  const rank = (g: BlockGroup) => {
    const i = routeOrder?.indexOf(g.postalCode) ?? -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  return result.sort((a, b) => rank(a) - rank(b) || compareBlockNumbers(a.blockNo, b.blockNo));
}

// Cancelled units do not count towards the total.
export function progress(statuses: DeliveryStatus[]): { done: number; total: number } {
  const active = statuses.filter((s) => s !== "cancelled");
  return { done: active.filter(isDone).length, total: active.length };
}
