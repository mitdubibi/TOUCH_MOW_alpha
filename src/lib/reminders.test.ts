import { describe, expect, it } from "vitest";
import { dueReminder, reminderMessage, reminderTimes } from "./reminders";

// Singapore clock time as a moment.
const sg = (date: string, time: string) => new Date(`${date}T${time}:00+08:00`);

describe("reminderTimes", () => {
  it("is 7 pm the day before and 1 hour before the start", () => {
    const t = reminderTimes("2026-10-22", "08:30:00");
    expect(t.evening_before).toEqual(sg("2026-10-21", "19:00"));
    expect(t.hour_before).toEqual(sg("2026-10-22", "07:30"));
    expect(t.start).toEqual(sg("2026-10-22", "08:30"));
  });

  it("works across a month end", () => {
    expect(reminderTimes("2026-11-01", "14:30").evening_before).toEqual(sg("2026-10-31", "19:00"));
  });
});

describe("dueReminder", () => {
  const due = (at: string) => dueReminder("2026-10-22", "08:30:00", new Date(at));

  it("is nothing before 7 pm the day before", () => {
    expect(due("2026-10-21T18:59:00+08:00")).toBeNull();
  });

  it("is the evening reminder from 7 pm until 1 hour before", () => {
    expect(due("2026-10-21T19:00:00+08:00")).toBe("evening_before");
    expect(due("2026-10-22T07:29:00+08:00")).toBe("evening_before");
  });

  it("is the hour reminder in the last hour, then nothing once started", () => {
    expect(due("2026-10-22T07:30:00+08:00")).toBe("hour_before");
    expect(due("2026-10-22T08:29:00+08:00")).toBe("hour_before");
    expect(due("2026-10-22T08:30:00+08:00")).toBeNull();
  });

  it("gives a volunteer added on the day only the reminder for that moment", () => {
    // Dinner at 2:30 pm, volunteer added at 10 am: the evening window is still open.
    expect(dueReminder("2026-10-22", "14:30", sg("2026-10-22", "10:00"))).toBe("evening_before");
    expect(dueReminder("2026-10-22", "14:30", sg("2026-10-22", "13:45"))).toBe("hour_before");
  });
});

describe("reminderMessage", () => {
  const base = {
    slot: "lunch" as const,
    date: "2026-10-22",
    startTime: "08:30:00",
    centreName: "Jurong West Kitchen (demo)",
    address: "Blk 518 Jurong West St 52 #01-100 (demo), Singapore 640518",
    postalCode: "640518",
    volunteerName: "Vince",
    link: "http://localhost:3000/volunteer/session/abc",
  };

  it("gives the time and collection centre address", () => {
    const m = reminderMessage({ ...base, kind: "evening_before" }, sg("2026-10-21", "19:00"));
    expect(m.title).toBe("Reminder: Lunch delivery tomorrow at 8:30 am");
    expect(m.when).toBe("Thu, 22 Oct 2026, 8:30 am");
    expect(m.text).toContain("Collect the meals at: Jurong West Kitchen (demo), Blk 518 Jurong West St 52");
    expect(m.text).toContain(base.link);
    expect(m.text).not.toMatch(/[—–]/);
  });

  it("says starting soon for the hour reminder", () => {
    const m = reminderMessage({ ...base, kind: "hour_before" }, sg("2026-10-22", "07:30"));
    expect(m.title).toBe("Starting soon: Lunch delivery at 8:30 am");
    expect(m.text).toContain("starts in about 1 hour");
  });

  it("falls back to the postal code when the centre has no address", () => {
    const m = reminderMessage({ ...base, kind: "evening_before", address: null });
    expect(m.where).toBe("Jurong West Kitchen (demo), postal code 640518");
  });
});
