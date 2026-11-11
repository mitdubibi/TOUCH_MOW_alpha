import { formatClock, formatDate, todayInSingapore } from "@/lib/dates";
import type { createClient } from "@/lib/supabase/server";
import { markRecipientMessageRead } from "./actions";

type Row = {
  id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  units: { unit_no: string; blocks: { block_no: string } | null } | null;
};

// Messages sent from recipients' private links. New ones first, with a button to mark each as handled.
export async function RecipientMessages({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data } = await supabase
    .from("messages")
    .select("id, body, created_at, read_at, units(unit_no, blocks(block_no))")
    .eq("thread_type", "recipient")
    .order("created_at", { ascending: false })
    .limit(30)
    .returns<Row[]>();
  const rows = [...(data ?? [])].sort((a, b) => Number(Boolean(a.read_at)) - Number(Boolean(b.read_at)));
  const unread = rows.filter((r) => !r.read_at).length;
  const today = todayInSingapore();

  return (
    <details open={unread > 0} className="rounded-xl border border-slate-300 bg-white p-4">
      <summary className="cursor-pointer text-lg font-semibold">
        Messages from homes{" "}
        {unread > 0 && <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-sm text-white">{unread} new</span>}
      </summary>
      {!rows.length && <p className="mt-2 text-slate-700">No messages yet.</p>}
      <ul className="mt-3 space-y-2">
        {rows.map((m) => {
          const sentDay = todayInSingapore(new Date(m.created_at));
          return (
            <li
              key={m.id}
              className={`rounded-lg p-3 ${m.read_at ? "bg-slate-50 text-slate-600" : "border-l-4 border-brand bg-brand-light"}`}
            >
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <strong>
                  {m.units ? `Blk ${m.units.blocks?.block_no ?? "?"} ${m.units.unit_no}` : "Unknown home"}
                </strong>
                <span>
                  {sentDay === today ? "" : `${formatDate(sentDay)}, `}
                  {formatClock(m.created_at)}
                </span>
              </div>
              <p className="mt-1 text-lg">{m.body}</p>
              {!m.read_at && (
                <form action={markRecipientMessageRead} className="mt-2">
                  <input type="hidden" name="id" value={m.id} />
                  <button className="rounded-lg border border-brand px-3 py-1 text-sm font-semibold text-brand-dark">
                    Mark as handled
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
