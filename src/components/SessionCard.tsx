import Link from "next/link";
import { progress } from "@/lib/checklist";
import { formatDate, formatTime, SLOT_LABEL } from "@/lib/dates";
import type { DeliveryStatus, SessionSummary } from "@/types/db";

type Props = {
  session: SessionSummary;
  statuses: DeliveryStatus[];
  href: string;
};

export function SessionCard({ session, statuses, href }: Props) {
  const { done, total } = progress(statuses);
  return (
    <Link href={href} className="block rounded-xl border border-slate-200 p-4 active:bg-slate-50">
      <p className="text-lg font-semibold">
        {formatDate(session.date)} · {SLOT_LABEL[session.slot]} {formatTime(session.start_time)}
      </p>
      <p className="text-slate-700">{session.centres?.name}</p>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200" aria-hidden>
          <div className="h-full bg-teal-600" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
        <span className="text-sm text-slate-700">
          {done} of {total} done
        </span>
      </div>
    </Link>
  );
}
