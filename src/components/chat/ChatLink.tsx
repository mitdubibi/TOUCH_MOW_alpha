import Link from "next/link";
import { formatClock } from "@/lib/dates";
import type { ChatMessage } from "@/types/db";

// Button to a session's team chat, with the newest message as a preview.
export function ChatLink({ href, latest }: { href: string; latest: ChatMessage | null }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-xl border-2 border-navy px-4 py-3 active:bg-slate-50">
      <span aria-hidden className="text-2xl">
        💬
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold">Team chat</span>
        <span className="block truncate text-sm text-slate-600">
          {latest ? `${latest.sender_name}: ${latest.body}` : "Message the coordinator and your team"}
        </span>
      </span>
      {latest && <span className="shrink-0 text-xs text-slate-500">{formatClock(latest.created_at)}</span>}
    </Link>
  );
}
