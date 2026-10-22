"use server";

import { requireOrganiser } from "@/lib/auth";
import { formatClock } from "@/lib/dates";
import { sendDueReminders } from "@/lib/sendReminders";

export type SendRemindersState = { message?: string; error?: string };

// "Send due reminders now" on the organiser home page. The cron job does the same every 5 minutes.
// For testing (not in production) the organiser can pretend it is another time, e.g. 7:05 pm.
export async function sendRemindersNow(_prev: SendRemindersState, formData: FormData): Promise<SendRemindersState> {
  await requireOrganiser();
  const pretend = String(formData.get("pretend") ?? "");
  let now = new Date();
  if (pretend && process.env.NODE_ENV !== "production") {
    // datetime-local gives "2026-10-21T19:05" in Singapore time.
    now = new Date(`${pretend}:00+08:00`);
    if (Number.isNaN(now.getTime())) return { error: "That time is not valid." };
  }
  try {
    const r = await sendDueReminders(now);
    if (!r.sent) return { message: `No reminders due at ${formatClock(now)}.` };
    const email = r.emailFailed ? `${r.emailed} emailed, ${r.emailFailed} email${r.emailFailed === 1 ? "" : "s"} not sent` : `${r.emailed} emailed`;
    return { message: `Sent ${r.sent} reminder${r.sent === 1 ? "" : "s"} in the app (${email}).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
