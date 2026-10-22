import { NextResponse } from "next/server";
import { sendDueReminders } from "@/lib/sendReminders";

// Called every 5 minutes by a Supabase pg_cron job (see README). Needs the CRON_SECRET from .env.local.
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  try {
    return NextResponse.json(await sendDueReminders());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
