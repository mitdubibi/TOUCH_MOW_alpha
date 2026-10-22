// FAKE DATA ONLY (PDPA). Every name, unit, remark and phone detail here is made up.
// Used by the presentation prototype under /demo. Block positions are approximate.

import type { Slot } from "@/types/db";

export type DemoCentre = { id: string; name: string; address: string; lat: number; lng: number };
export type DemoBlock = { postal: string; blockNo: string; street: string; lat: number; lng: number };
export type DemoUnit = {
  id: string;
  postal: string;
  unitNo: string;
  floor: number;
  mealType: string;
  remarks: string;
  lang: "en" | "zh";
};
export type DemoVolunteer = { id: string; name: string; initials: string; colour: string };
export type DemoSession = {
  id: string;
  dayOffset: number; // 0 = today, 1 = tomorrow
  slot: Slot;
  startTime: string;
  unitIds: string[];
  team: string[];
};
export type DemoMessage = {
  id: string;
  thread: string; // a volunteer id, or "recipients"
  from: "organiser" | "volunteer" | "recipient";
  unitId?: string;
  body: string;
  time: string;
};

export const CENTRE: DemoCentre = {
  id: "c1",
  name: "Jurong West Kitchen (demo)",
  address: "Jurong West St 52",
  lat: 1.3494,
  lng: 103.7168,
};

export const BLOCKS: DemoBlock[] = [
  { postal: "640501", blockNo: "501", street: "Jurong West St 51", lat: 1.3508, lng: 103.7182 },
  { postal: "640502", blockNo: "502", street: "Jurong West St 51", lat: 1.3516, lng: 103.7166 },
  { postal: "640513", blockNo: "513", street: "Jurong West St 52", lat: 1.35, lng: 103.7146 },
  { postal: "640516", blockNo: "516", street: "Jurong West St 52", lat: 1.3487, lng: 103.7136 },
  { postal: "640518", blockNo: "518", street: "Jurong West St 52", lat: 1.3479, lng: 103.7158 },
  { postal: "640524", blockNo: "524", street: "Jurong West St 52", lat: 1.347, lng: 103.7183 },
];

export const UNITS: DemoUnit[] = [
  { id: "u01", postal: "640501", unitNo: "#03-110", floor: 3, mealType: "Normal", remarks: "", lang: "en" },
  { id: "u02", postal: "640501", unitNo: "#07-114", floor: 7, mealType: "Soft", remarks: "Knock loudly", lang: "en" },
  { id: "u03", postal: "640501", unitNo: "#11-118", floor: 11, mealType: "Diabetic", remarks: "", lang: "zh" },
  { id: "u04", postal: "640501", unitNo: "#12-120", floor: 12, mealType: "Normal", remarks: "Ring bell twice", lang: "en" },
  { id: "u05", postal: "640502", unitNo: "#02-205", floor: 2, mealType: "Normal", remarks: "", lang: "en" },
  { id: "u06", postal: "640502", unitNo: "#09-213", floor: 9, mealType: "Vegetarian", remarks: "", lang: "zh" },
  { id: "u07", postal: "640502", unitNo: "#12-209", floor: 12, mealType: "Normal", remarks: "Leave on chair outside", lang: "en" },
  { id: "u08", postal: "640513", unitNo: "#04-301", floor: 4, mealType: "Soft", remarks: "", lang: "zh" },
  { id: "u09", postal: "640513", unitNo: "#04-305", floor: 4, mealType: "Normal", remarks: "Gate unlocked, leave on chair", lang: "en" },
  { id: "u10", postal: "640513", unitNo: "#10-311", floor: 10, mealType: "Diabetic", remarks: "No sugar drinks", lang: "en" },
  { id: "u11", postal: "640513", unitNo: "#13-315", floor: 13, mealType: "Normal", remarks: "", lang: "zh" },
  { id: "u12", postal: "640516", unitNo: "#01-402", floor: 1, mealType: "Normal", remarks: "", lang: "en" },
  { id: "u13", postal: "640516", unitNo: "#06-410", floor: 6, mealType: "Soft", remarks: "Hard of hearing", lang: "zh" },
  { id: "u14", postal: "640516", unitNo: "#13-412", floor: 13, mealType: "Vegetarian", remarks: "", lang: "en" },
  { id: "u15", postal: "640518", unitNo: "#05-123", floor: 5, mealType: "Normal", remarks: "", lang: "en" },
  { id: "u16", postal: "640518", unitNo: "#05-127", floor: 5, mealType: "Diabetic", remarks: "", lang: "en" },
  { id: "u17", postal: "640518", unitNo: "#09-131", floor: 9, mealType: "Soft", remarks: "Call before arriving", lang: "zh" },
  { id: "u18", postal: "640524", unitNo: "#02-540", floor: 2, mealType: "Normal", remarks: "", lang: "en" },
  { id: "u19", postal: "640524", unitNo: "#07-548", floor: 7, mealType: "Soft", remarks: "Uses walking frame, wait at door", lang: "zh" },
  { id: "u20", postal: "640524", unitNo: "#14-544", floor: 14, mealType: "Normal", remarks: "", lang: "en" },
];

export const VOLUNTEERS: DemoVolunteer[] = [
  { id: "v1", name: "Vince", initials: "VT", colour: "#2563eb" },
  { id: "v2", name: "Valerie", initials: "VL", colour: "#db2777" },
  { id: "v3", name: "Wei Ming", initials: "WM", colour: "#16a34a" },
];

const ALL_UNITS = UNITS.map((u) => u.id);

export const SESSIONS: DemoSession[] = [
  { id: "s-lunch", dayOffset: 0, slot: "lunch", startTime: "08:30", unitIds: ALL_UNITS, team: ["v1", "v2"] },
  {
    id: "s-dinner",
    dayOffset: 0,
    slot: "dinner",
    startTime: "14:30",
    unitIds: ["u02", "u06", "u10", "u13", "u17", "u19"],
    team: ["v3"],
  },
  { id: "s-tomorrow", dayOffset: 1, slot: "lunch", startTime: "08:30", unitIds: ALL_UNITS, team: ["v1", "v2", "v3"] },
];

// The demo starts mid-session: this many units on each lunch route are already delivered.
export const LUNCH_ALREADY_DELIVERED = 3;

export const INITIAL_MESSAGES: DemoMessage[] = [
  { id: "m1", thread: "v1", from: "organiser", body: "Hi Vince, lunch starts 8:30 at Jurong West Kitchen. Thank you!", time: "7:45 am" },
  { id: "m2", thread: "v1", from: "volunteer", body: "Noted, on my way.", time: "7:52 am" },
  { id: "m3", thread: "v2", from: "organiser", body: "Valerie, the Blk 513 lift is under maintenance today. Please use the stairs.", time: "8:02 am" },
  { id: "m4", thread: "v3", from: "organiser", body: "Wei Ming, dinner run today is 6 units. Collect at 2:30 pm.", time: "8:10 am" },
  { id: "m5", thread: "recipients", from: "recipient", unitId: "u11", body: "Please call me", time: "8:15 am" },
];

export const PROBLEM_LABEL = {
  uneaten: "Meal uneaten",
  no_answer: "No answer",
  wrong_address: "Wrong address",
} as const;

export const RECIPIENT_PRESETS = {
  en: ["I am not home today", "Please call me", "I do not need a meal today"],
  zh: ["我今天不在家", "请打电话给我", "我今天不需要餐点"],
} as const;

// A delivery list as TOUCH would export it, for the upload preview. date is DD/MM/YYYY.
export function sampleCsv(date: string): string {
  const header = "Date,Session,Block,Unit,Postal Code,Meal Type,Remarks";
  const rows = UNITS.map((u) => {
    const block = BLOCKS.find((b) => b.postal === u.postal)!;
    const remarks = u.remarks.includes(",") ? `"${u.remarks}"` : u.remarks;
    return [date, "Lunch", `Blk ${block.blockNo}`, u.unitNo, u.postal, u.mealType, remarks].join(",");
  });
  return [header, ...rows].join("\n");
}

// Same list with typical mistakes, to show what the checks catch.
export function sampleCsvWithMistakes(date: string): string {
  const lines = sampleCsv(date).split("\n");
  lines[3] = lines[3].replace(date, "31/02/2026");
  lines[6] = lines[6].replace("#12-209", "12th floor");
  lines[9] = lines[9].replace("640513", "64051");
  lines.push(lines[2]);
  return lines.join("\n");
}
