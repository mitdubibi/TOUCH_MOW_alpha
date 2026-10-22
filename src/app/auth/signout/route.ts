import { NextResponse, type NextRequest } from "next/server";
import { RECIPIENT_COOKIE } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 });
  response.cookies.delete(RECIPIENT_COOKIE);
  return response;
}
