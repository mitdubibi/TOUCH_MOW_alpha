// OneMap API calls (server only: uses the OneMap login from .env.local).
// Docs: https://www.onemap.gov.sg/apidocs/

import type { LatLng } from "@/lib/route/optimise";

const BASE = "https://www.onemap.gov.sg";

export class OneMapError extends Error {}

let token: { value: string; expiresAt: number } | null = null;

// Tokens last 3 days. Kept in memory and renewed an hour before they run out.
export async function getToken(): Promise<string> {
  if (token && token.expiresAt - Date.now() > 60 * 60 * 1000) return token.value;
  const email = process.env.ONEMAP_EMAIL;
  const password = process.env.ONEMAP_PASSWORD;
  if (!email || !password) throw new OneMapError("Set ONEMAP_EMAIL and ONEMAP_PASSWORD in .env.local");

  const res = await fetch(`${BASE}/api/auth/post/getToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.access_token) {
    throw new OneMapError(`OneMap login failed: ${body?.error ?? res.status}`);
  }
  token = { value: body.access_token, expiresAt: Number(body.expiry_timestamp) * 1000 };
  return token.value;
}

// OneMap sometimes answers busy callers with an empty body or 429. Try a few times before giving up.
async function getJson(url: string, auth: string): Promise<Record<string, unknown>> {
  let lastError = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    const res = await fetch(url, { headers: { Authorization: auth }, cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      token = null;
      throw new OneMapError("OneMap rejected the API token");
    }
    const body = await res.json().catch(() => null);
    if (res.ok && body && typeof body === "object") return body;
    lastError = `HTTP ${res.status}`;
  }
  throw new OneMapError(`OneMap did not answer (${lastError})`);
}

export type Geocode = LatLng & { blockNo: string; street: string };

// Postal code to coordinates. Null when OneMap has no building with that exact postal code.
export async function geocodePostal(postal: string): Promise<Geocode | null> {
  const url = `${BASE}/api/common/elastic/search?searchVal=${postal}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
  const body = await getJson(url, await getToken());
  const results = (body.results ?? []) as Record<string, string>[];
  const hit = results.find((r) => r.POSTAL === postal);
  if (!hit) return null;
  return {
    lat: Number(hit.LATITUDE),
    lng: Number(hit.LONGITUDE),
    blockNo: hit.BLK_NO,
    street: titleCase(hit.ROAD_NAME),
  };
}

export type Walk = { seconds: number; metres: number; path: string | null };

export async function walkRoute(from: LatLng, to: LatLng): Promise<Walk> {
  const url =
    `${BASE}/api/public/routingsvc/route?start=${from.lat},${from.lng}` +
    `&end=${to.lat},${to.lng}&routeType=walk`;
  const body = await getJson(url, await getToken());
  const summary = body.route_summary as { total_time?: number; total_distance?: number } | undefined;
  if (typeof summary?.total_time !== "number") {
    throw new OneMapError(`OneMap found no walking route (${String(body.status_message ?? body.error ?? "")})`);
  }
  return {
    seconds: Math.round(summary.total_time),
    metres: Math.round(summary.total_distance ?? 0),
    path: typeof body.route_geometry === "string" ? body.route_geometry : null,
  };
}

// Runs fn over items with at most `limit` calls in flight (OneMap allows about 250 calls a minute).
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
