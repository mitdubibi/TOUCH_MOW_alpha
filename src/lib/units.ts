// Parsing and sorting for HDB blocks, units and postal codes.

export type ParsedUnit = { unit: string; floor: number };

const UNIT_RE = /^#?\s*(\d{1,3})\s*-\s*(\d{1,5}[A-Z]?)$/i;

// "#05-123", "05-123", "5-123" and "#5-123a" all become { unit: "#05-123", floor: 5 }.
export function parseUnit(raw: string): ParsedUnit | null {
  const m = raw.trim().match(UNIT_RE);
  if (!m) return null;
  const floor = Number(m[1]);
  if (floor < 1 || floor > 60) return null;
  return { unit: `#${String(floor).padStart(2, "0")}-${m[2].toUpperCase()}`, floor };
}

// "Blk 518", "block 518A" and "518a" become "518" / "518A".
export function parseBlock(raw: string): string | null {
  const b = raw.trim().replace(/^(blk|block)\.?\s*/i, "").toUpperCase();
  return /^\d{1,4}[A-Z]?$/.test(b) ? b : null;
}

// Spreadsheets drop leading zeros, so a 5-digit code is padded back to 6.
export function parsePostalCode(raw: string): string | null {
  const s = raw.trim();
  if (!/^\d{5,6}$/.test(s)) return null;
  return s.padStart(6, "0");
}

// Lift to the top floor, then walk down: higher floors first, then by unit number.
export function compareUnitsTopDown(
  a: { floor: number; unit_no: string },
  b: { floor: number; unit_no: string },
): number {
  return b.floor - a.floor || a.unit_no.localeCompare(b.unit_no, undefined, { numeric: true });
}

export function compareBlockNumbers(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}
