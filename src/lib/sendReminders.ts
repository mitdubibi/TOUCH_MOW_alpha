import { addDays, todayInSingapore } from "@/lib/dates";
import { sendEmail } from "@/lib/email";
import { dueReminder, reminderMessage, reminderTimes } from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ReminderKind, SessionStatus, Slot } from "@/types/db";

type SessionRow = {
  id: string;
  date: string;
  slot: Slot;
  start_time: string;
  status: SessionStatus;
  centres: { name: string; address: string | null; postal_code: string } | null;
  session_volunteers: { volunteer_id: string; profiles: { display_name: string } | null }[];
};

export type ReminderRun = { sent: number; emailed: number; emailFailed: number };

// Sends every reminder that is due now and was not sent before. Safe to run as often as you like
// (the cron job runs it every 5 minutes): the unique (session, volunteer, kind) row is the lock.
// Server only: uses the service role key.
export async function sendDueReminders(now = new Date()): Promise<ReminderRun> {
  const admin = createAdminClient();
  const today = todayInSingapore(now);

  const { data: sessions, error } = await admin
    .from("sessions")
    .select(
      "id, date, slot, start_time, status, centres(name, address, postal_code), " +
        "session_volunteers(volunteer_id, profiles(display_name))",
    )
    .gte("date", today)
    .lte("date", addDays(today, 1))
    .neq("status", "done")
    .returns<SessionRow[]>();
  if (error) throw error;

  const due: { session: SessionRow; volunteerId: string; name: string; kind: ReminderKind }[] = [];
  for (const session of sessions) {
    const kind = dueReminder(session.date, session.start_time, now);
    if (!kind) continue;
    for (const v of session.session_volunteers) {
      due.push({ session, volunteerId: v.volunteer_id, name: v.profiles?.display_name ?? "", kind });
    }
  }
  if (!due.length) return { sent: 0, emailed: 0, emailFailed: 0 };

  // Only rows that were not there yet come back, so two runs at once cannot send twice.
  const { data: claimed, error: claimError } = await admin
    .from("reminders")
    .upsert(
      due.map((d) => ({
        session_id: d.session.id,
        volunteer_id: d.volunteerId,
        kind: d.kind,
        channel: "in_app",
        send_at: reminderTimes(d.session.date, d.session.start_time)[d.kind].toISOString(),
        sent_at: new Date().toISOString(),
      })),
      { onConflict: "session_id,volunteer_id,kind", ignoreDuplicates: true },
    )
    .select("id, session_id, volunteer_id, kind")
    .returns<{ id: string; session_id: string; volunteer_id: string; kind: ReminderKind }[]>();
  if (claimError) throw claimError;

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  let emailed = 0;
  let emailFailed = 0;
  for (const row of claimed) {
    const d = due.find((x) => x.session.id === row.session_id && x.volunteerId === row.volunteer_id)!;
    const { session } = d;
    const message = reminderMessage(
      {
        kind: row.kind,
        slot: session.slot,
        date: session.date,
        startTime: session.start_time,
        centreName: session.centres?.name ?? "the collection centre",
        address: session.centres?.address ?? null,
        postalCode: session.centres?.postal_code ?? "",
        volunteerName: d.name,
        link: `${site}/volunteer/session/${session.id}`,
      },
      now,
    );

    const { data: user } = await admin.auth.admin.getUserById(row.volunteer_id);
    const email = user.user?.email;
    const result = email ? await sendEmail({ to: email, subject: message.title, text: message.text }) : { error: "No email address" };
    if (result.error) emailFailed++;
    else emailed++;
    await admin
      .from("reminders")
      .update(
        result.error
          ? { error: result.error.slice(0, 300) }
          : { channel: "in_app+email", email_sent_at: new Date().toISOString(), error: null },
      )
      .eq("id", row.id);
  }

  return { sent: claimed.length, emailed, emailFailed };
}
