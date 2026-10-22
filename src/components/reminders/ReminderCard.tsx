import Link from "next/link";
import { dismissReminder } from "@/app/volunteer/actions";
import { reminderMessage } from "@/lib/reminders";
import type { ReminderKind, Slot } from "@/types/db";

export type ReminderRow = {
  id: string;
  kind: ReminderKind;
  session_id: string;
  sessions: {
    date: string;
    slot: Slot;
    start_time: string;
    centres: { name: string; address: string | null; postal_code: string } | null;
  } | null;
};

// An in-app reminder on the volunteer's home page: time and collection centre address.
export function ReminderCard({ reminder }: { reminder: ReminderRow & { sessions: NonNullable<ReminderRow["sessions"]> } }) {
  const s = reminder.sessions;
  const m = reminderMessage({
    kind: reminder.kind,
    slot: s.slot,
    date: s.date,
    startTime: s.start_time,
    centreName: s.centres?.name ?? "the collection centre",
    address: s.centres?.address ?? null,
    postalCode: s.centres?.postal_code ?? "",
  });

  return (
    <section role="status" className="space-y-2 rounded-xl border-2 border-sun bg-sun-light p-4 text-navy">
      <h2 className="text-lg font-bold">🔔 {m.title}</h2>
      <p>
        <span className="font-semibold">When: </span>
        {m.when}
      </p>
      <p>
        <span className="font-semibold">Collect at: </span>
        {m.where}
      </p>
      <div className="flex gap-2 pt-1">
        <Link
          href={`/volunteer/session/${reminder.session_id}`}
          className="flex-1 rounded-lg bg-navy px-3 py-2 text-center font-semibold text-white"
        >
          Open checklist
        </Link>
        <form action={dismissReminder}>
          <input type="hidden" name="sessionId" value={reminder.session_id} />
          <button className="rounded-lg border-2 border-navy px-4 py-2 font-semibold">Got it</button>
        </form>
      </div>
    </section>
  );
}
