import { NextResponse } from "next/server";
import { parseDeliveryList } from "@/lib/csv/parseDeliveryList";
import { createClient } from "@/lib/supabase/server";

const MAX_CSV_CHARS = 1_000_000;

// The browser already showed a preview, but the CSV is parsed again here so bad rows never reach the database.
// The database function checks the caller is an organiser and does the merge in one transaction.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.centreId !== "string" || typeof body.csvText !== "string") {
    return NextResponse.json({ error: "Choose a centre and a CSV file." }, { status: 400 });
  }
  if (body.csvText.length > MAX_CSV_CHARS) {
    return NextResponse.json({ error: "The file is too large." }, { status: 413 });
  }

  const { rows, errors } = parseDeliveryList(body.csvText);
  if (errors.length || !rows.length) {
    return NextResponse.json({ error: "The file has problems. Fix them and try again.", errors }, { status: 422 });
  }

  const { data, error } = await supabase.rpc("import_delivery_list", {
    p_centre_id: body.centreId,
    p_file_name: String(body.fileName ?? "upload.csv").slice(0, 200),
    p_rows: rows.map((r) => ({
      date: r.date,
      slot: r.slot,
      block: r.block,
      unit: r.unit,
      floor: r.floor,
      postal_code: r.postalCode,
      meal_type: r.mealType,
      remarks: r.remarks,
    })),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === "42501" ? 403 : 500 });
  }
  return NextResponse.json({ sessions: data });
}
