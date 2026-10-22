import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  // The role picker, testers' page, /demo prototype and recipient links (/t/...) use no login, so they skip the
  // Supabase round trip.
  const { pathname } = request.nextUrl;
  if (pathname === "/" || pathname === "/test" || pathname.startsWith("/demo") || pathname.startsWith("/t/")) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  // Not for static files (app icons, manifest).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|ico)$).*)"],
};
