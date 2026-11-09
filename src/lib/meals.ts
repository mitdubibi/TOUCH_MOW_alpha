// TOUCH's meal type codes, as printed on their delivery lists.
export const MEAL_TYPES = ["H-BR", "HH", "H", "H-M", "H-B", "V"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

const MEANING: Record<MealType, string> = { "H-BR": "normal", HH: "", H: "", "H-M": "minced", "H-B": "", V: "" };

// "H-BR (normal)", "HH", "H-M (minced)". Older free-text values are shown as they are.
export function mealLabel(code: string): string {
  const meaning = MEANING[code as MealType];
  return meaning ? `${code} (${meaning})` : code;
}

// Accepts the codes in any case, without the dash ("HBR", "hm", "hb"), or the words "normal" and "minced".
export function parseMealType(raw: string): MealType | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (s === "NORMAL") return "H-BR";
  if (s === "MINCED") return "H-M";
  return MEAL_TYPES.find((m) => m === s || m.replace("-", "") === s) ?? null;
}
