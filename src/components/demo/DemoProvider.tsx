"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { resetDemoData } from "@/app/(demo)/actions";
import { CENTRE, type DemoMessage } from "@/data/mockData";
import {
  applyDelivery,
  loadShared,
  toLocation,
  toMessage,
  toProblem,
  type DeliveryRow,
  type LocationRow,
  type MessageRow,
  type ProblemRow,
  type SharedState,
} from "@/lib/demo/db";
import {
  autoSplit,
  defaultElderlyUnit,
  deliveryKey,
  liveLocation,
  routeFor,
  sessionById,
  statusOf,
  unitById,
  type DemoState,
  type ProblemKind,
} from "@/lib/demo/model";
import { metresBetween, WALK_METRES_PER_MIN, type LatLng } from "@/lib/demo/route";
import { createClient } from "@/lib/supabase/client";
import type { DeliveryStatus } from "@/types/db";

// The demo's data lives in Supabase (demo_ tables), so every phone and browser window sees the
// same thing: changes are written straight away and other screens get them through realtime.
// Only "viewing as" (volunteer) and "this phone belongs to" (elderly) are per browser tab.

export type DemoAction =
  | { type: "setStatus"; sessionId: string; unitId: string; status: DeliveryStatus }
  | { type: "report"; sessionId: string; unitId: string; volunteerId: string; kind: ProblemKind; note: string; time: string }
  | { type: "assign"; sessionId: string; postal: string; volunteerId: string }
  | { type: "autoSplit"; sessionId: string }
  | { type: "send"; message: Omit<DemoMessage, "id"> }
  | { type: "setVolunteer"; volunteerId: string }
  | { type: "setElderlyUnit"; unitId: string }
  | { type: "reset" };

export type Tracking = {
  sessionId: string;
  volunteerId: string;
  mode: "gps" | "sim";
  note: string;
};

type DemoContextValue = {
  state: DemoState;
  dispatch: (action: DemoAction) => void;
  tracking: Tracking | null;
  startTracking: (sessionId: string, mode: Tracking["mode"]) => void;
  stopTracking: () => void;
};

const DemoContext = createContext<DemoContextValue | null>(null);

const GPS_SEND_EVERY_MS = 30_000;
const SIM_TICK_MS = 2_000;
// Simulated walking runs at 10 times walking speed so a demo does not take an hour.
const SIM_SPEED = 10;
const SIM_STEP_M = ((WALK_METRES_PER_MIN * SIM_SPEED) / 60) * (SIM_TICK_MS / 1000);

const postalOf = (unitId: string) => unitById(unitId).postal;

// Per-tab settings. Storage can be blocked (private windows), so every access is guarded.
function readTab(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeTab(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Not remembered; fine for a demo.
  }
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [shared, setShared] = useState<SharedState | null>(null);
  // Read once on the client. The server renders the loading screen, which shows neither.
  const [volunteerId, setVolunteerId] = useState(() => readTab("demo.volunteerId") ?? "v1");
  const [elderlyUnitId, setElderlyUnitId] = useState<string | null>(() => readTab("demo.elderlyUnitId"));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [tick, setTick] = useState(0);
  const seeding = useRef(false);

  const reload = useCallback(async () => {
    try {
      let next = await loadShared(supabase, postalOf);
      if (!next.hasData && !seeding.current) {
        // First run on a new database: fill it with the fake data.
        seeding.current = true;
        const { error } = await resetDemoData();
        if (error) throw new Error(error);
        next = await loadShared(supabase, postalOf);
      }
      setShared(next);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, [supabase]);
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  // Several changes arrive together (e.g. a reset), so reload once they settle.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadSoon = useCallback((delayMs = 400) => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => void reloadRef.current(), delayMs);
  }, []);

  useEffect(() => reloadSoon(0), [reloadSoon]);

  // Realtime: frequent changes are patched in place, anything else reloads everything (it is small).
  useEffect(() => {
    const channel = supabase
      .channel("demo")
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_deliveries" }, (payload) => {
        if (payload.eventType !== "UPDATE") return reloadSoon();
        const row = payload.new as DeliveryRow;
        setShared((s) => (s ? { ...s, ...applyDelivery(s, row, postalOf) } : s));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_volunteer_locations" }, (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as LocationRow;
        const key = deliveryKey(row.session_id, row.volunteer_id);
        setShared((s) => {
          if (!s) return s;
          const locations = { ...s.locations };
          if (payload.eventType === "DELETE") delete locations[key];
          else locations[key] = toLocation(row);
          return { ...s, locations };
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_messages" }, (payload) => {
        if (payload.eventType !== "INSERT") return reloadSoon();
        const m = toMessage(payload.new as MessageRow);
        setShared((s) => (s && !s.messages.some((x) => x.id === m.id) ? { ...s, messages: [...s.messages, m] } : s));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_problem_reports" }, (payload) => {
        if (payload.eventType !== "INSERT") return reloadSoon();
        const p = toProblem(payload.new as ProblemRow);
        setShared((s) => (s && !s.problems.some((x) => x.id === p.id) ? { ...s, problems: [p, ...s.problems] } : s));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_sessions" }, () => reloadSoon())
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_units" }, () => reloadSoon())
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_volunteers" }, () => reloadSoon())
      .subscribe((status) => {
        // Catch up on anything missed while (re)connecting.
        if (status === "SUBSCRIBED") reloadSoon();
      });

    // Phones drop the connection when the screen is off: catch up when it comes back.
    const onVisible = () => document.visibilityState === "visible" && reloadSoon();
    document.addEventListener("visibilitychange", onVisible);
    // Re-draw every 30 s so positions that stopped updating go stale on screen.
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      void supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
    };
  }, [supabase, reloadSoon]);

  const state = useMemo<DemoState | null>(() => {
    if (!shared) return null;
    const base: DemoState = { ...shared, volunteerId, elderlyUnitId: "", nextId: 0 };
    return { ...base, elderlyUnitId: elderlyUnitId ?? defaultElderlyUnit(base) };
    // tick: re-render so stale locations drop out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared, volunteerId, elderlyUnitId, tick]);
  // The simulated walk reads the newest state from its timer.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // A write failed: say so and reload, so the screen matches the database again.
  const saved = useCallback(
    (error: { message: string } | null) => {
      if (!error) return true;
      setSaveError(
        !navigator.onLine || /fetch|network/i.test(error.message)
          ? "Not saved: no internet connection."
          : `Not saved: ${error.message}`,
      );
      void reloadRef.current();
      return false;
    },
    [],
  );

  const setStatus = useCallback(
    async (sessionId: string, unitId: string, status: DeliveryStatus) => {
      setShared((s) =>
        s
          ? { ...s, ...applyDelivery(s, { session_id: sessionId, unit_id: unitId, status, assigned_volunteer: null, delivered_at: null }, postalOf) }
          : s,
      );
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("demo_deliveries")
        .update({ status, delivered_at: status === "pending" ? null : now, updated_at: now })
        .eq("session_id", sessionId)
        .eq("unit_id", unitId);
      saved(error);
    },
    [supabase, saved],
  );

  const assignBlocks = useCallback(
    async (sessionId: string, byPostal: Record<string, string>) => {
      setShared((s) =>
        s ? { ...s, assignments: { ...s.assignments, [sessionId]: { ...s.assignments[sessionId], ...byPostal } } } : s,
      );
      const session = sessionById(sessionId);
      if (!session) return;
      for (const [postal, vid] of Object.entries(byPostal)) {
        const unitIds = session.unitIds.filter((id) => postalOf(id) === postal);
        const { error } = await supabase
          .from("demo_deliveries")
          .update({ assigned_volunteer: vid, updated_at: new Date().toISOString() })
          .eq("session_id", sessionId)
          .in("unit_id", unitIds);
        if (!saved(error)) return;
      }
    },
    [supabase, saved],
  );

  const dispatch = useCallback(
    (action: DemoAction) => {
      setSaveError(null);
      switch (action.type) {
        case "setStatus":
          return void setStatus(action.sessionId, action.unitId, action.status);
        case "assign":
          return void assignBlocks(action.sessionId, { [action.postal]: action.volunteerId });
        case "autoSplit": {
          const session = sessionById(action.sessionId);
          if (session) void assignBlocks(action.sessionId, autoSplit(session));
          return;
        }
        case "report":
          return void (async () => {
            const { data, error } = await supabase
              .from("demo_problem_reports")
              .insert({
                session_id: action.sessionId,
                unit_id: action.unitId,
                volunteer_id: action.volunteerId,
                kind: action.kind,
                note: action.note,
              })
              .select()
              .single<ProblemRow>();
            if (!saved(error)) return;
            const p = toProblem(data!);
            setShared((s) => (s && !s.problems.some((x) => x.id === p.id) ? { ...s, problems: [p, ...s.problems] } : s));
            // No answer also marks the unit Not home, so the recipient sees it.
            if (action.kind === "no_answer") await setStatus(action.sessionId, action.unitId, "not_home");
          })();
        case "send":
          return void (async () => {
            const { data, error } = await supabase
              .from("demo_messages")
              .insert({
                thread: action.message.thread,
                sender: action.message.from,
                unit_id: action.message.unitId ?? null,
                body: action.message.body,
              })
              .select()
              .single<MessageRow>();
            if (!saved(error)) return;
            const m = toMessage(data!);
            setShared((s) => (s && !s.messages.some((x) => x.id === m.id) ? { ...s, messages: [...s.messages, m] } : s));
          })();
        case "setVolunteer":
          writeTab("demo.volunteerId", action.volunteerId);
          return setVolunteerId(action.volunteerId);
        case "setElderlyUnit":
          writeTab("demo.elderlyUnitId", action.unitId);
          return setElderlyUnitId(action.unitId);
        case "reset":
          return void (async () => {
            setTracking(null);
            const { error } = await resetDemoData();
            if (error) setSaveError(`Reset failed: ${error}`);
            await reloadRef.current();
          })();
      }
    },
    [supabase, saved, setStatus, assignBlocks],
  );

  // ---------------------------------------------------------------------------
  // Sharing this volunteer's position: browser GPS every 30 s, or a simulated walk along the route.
  // Lives here (not in a page) so it keeps going when the volunteer switches between screens.
  // ---------------------------------------------------------------------------

  const sendLocation = useCallback(
    async (t: Pick<Tracking, "sessionId" | "volunteerId" | "mode">, at: LatLng) => {
      const row: LocationRow = {
        session_id: t.sessionId,
        volunteer_id: t.volunteerId,
        lat: at.lat,
        lng: at.lng,
        simulated: t.mode === "sim",
        updated_at: new Date().toISOString(),
      };
      setShared((s) =>
        s ? { ...s, locations: { ...s.locations, [deliveryKey(t.sessionId, t.volunteerId)]: toLocation(row) } } : s,
      );
      const { error } = await supabase.from("demo_volunteer_locations").upsert(row);
      if (error) setTracking((cur) => (cur ? { ...cur, note: `Location not sent: ${error.message}` } : cur));
    },
    [supabase],
  );

  const trackingKey = tracking && `${tracking.sessionId}:${tracking.volunteerId}:${tracking.mode}`;
  useEffect(() => {
    if (!tracking) return;
    const t = { sessionId: tracking.sessionId, volunteerId: tracking.volunteerId, mode: tracking.mode };
    const note = (text: string) => setTracking((cur) => (cur ? { ...cur, note: text } : cur));
    let stopped = false;

    if (t.mode === "gps") {
      if (!("geolocation" in navigator)) {
        note("This browser cannot share location. Try Simulate walking.");
        return;
      }
      let latest: LatLng | null = null;
      let sentOnce = false;
      const watch = navigator.geolocation.watchPosition(
        (pos) => {
          latest = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (!sentOnce && !stopped) {
            sentOnce = true;
            void sendLocation(t, latest);
            note("Sharing your location every 30 seconds.");
          }
        },
        (err) =>
          note(
            err.code === err.PERMISSION_DENIED
              ? "Location is blocked. Allow it in your browser settings, or use Simulate walking."
              : "Could not find your location. Try near a window, or use Simulate walking.",
          ),
        { enableHighAccuracy: true, maximumAge: 10_000 },
      );
      const timer = setInterval(() => latest && !stopped && void sendLocation(t, latest), GPS_SEND_EVERY_MS);
      return () => {
        stopped = true;
        navigator.geolocation.clearWatch(watch);
        clearInterval(timer);
      };
    }

    // Simulated walk: head for the next stop that still has units to deliver, wait there until
    // they are ticked, then walk on.
    const s0 = stateRef.current;
    const start = s0 && liveLocation(s0, t.sessionId, t.volunteerId)?.usable;
    let here: LatLng = start ? s0!.locations[deliveryKey(t.sessionId, t.volunteerId)] : { lat: CENTRE.lat, lng: CENTRE.lng };
    const step = () => {
      const s = stateRef.current;
      if (!s || stopped) return;
      const route = routeFor(s, t.sessionId, t.volunteerId);
      const next = route.find((stop) => stop.units.some((u) => statusOf(s, t.sessionId, u.id) === "pending"));
      if (!next) {
        note("All your stops are done.");
      } else {
        const dist = metresBetween(here, next.block);
        if (dist <= SIM_STEP_M) {
          here = { lat: next.block.lat, lng: next.block.lng };
          note(`At Blk ${next.block.blockNo} (stop ${next.stopNo}). Tick its units to walk on.`);
        } else {
          const f = SIM_STEP_M / dist;
          here = { lat: here.lat + (next.block.lat - here.lat) * f, lng: here.lng + (next.block.lng - here.lng) * f };
          note(`Walking to Blk ${next.block.blockNo} (stop ${next.stopNo}), ${Math.round(dist)} m to go.`);
        }
      }
      void sendLocation(t, here);
    };
    step();
    const timer = setInterval(step, SIM_TICK_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // Restart only when who or how changes, not on every note update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingKey, sendLocation]);

  const startTracking = useCallback(
    (sessionId: string, mode: Tracking["mode"]) => {
      const vid = stateRef.current?.volunteerId ?? "v1";
      setTracking({ sessionId, volunteerId: vid, mode, note: mode === "gps" ? "Finding your location..." : "Starting the walk..." });
    },
    [],
  );

  const stopTracking = useCallback(() => {
    const cur = tracking;
    setTracking(null);
    if (!cur) return;
    const key = deliveryKey(cur.sessionId, cur.volunteerId);
    setShared((s) => {
      if (!s) return s;
      const locations = { ...s.locations };
      delete locations[key];
      return { ...s, locations };
    });
    void supabase
      .from("demo_volunteer_locations")
      .delete()
      .eq("session_id", cur.sessionId)
      .eq("volunteer_id", cur.volunteerId)
      .then(({ error }) => saved(error));
  }, [tracking, supabase, saved]);

  if (!state) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-navy p-6 text-center text-white">
        {loadError ? (
          <>
            <p className="text-2xl font-bold">Could not load the demo data</p>
            <p className="text-white/80">{loadError}</p>
            <p className="text-sm text-white/70">
              Check the Supabase keys in .env.local and that supabase/migrations/0007_demo_shared_data.sql has been run.
            </p>
            <button type="button" onClick={() => void reload()} className="rounded-full bg-sun px-6 py-3 font-bold text-navy">
              Try again
            </button>
          </>
        ) : (
          <p className="text-xl font-semibold">Loading demo data...</p>
        )}
      </div>
    );
  }

  return (
    <DemoContext.Provider value={{ state, dispatch, tracking, startTracking, stopTracking }}>
      {saveError && (
        <div role="alert" className="fixed inset-x-0 top-0 z-[3000] flex items-center justify-between gap-3 bg-red-700 px-4 py-2 text-sm text-white">
          <span>{saveError}</span>
          <button type="button" onClick={() => setSaveError(null)} className="font-bold underline">
            OK
          </button>
        </div>
      )}
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside DemoProvider");
  return ctx;
}

// Time label for new messages and reports, e.g. "9:41 am".
export function nowLabel(): string {
  return new Date().toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Singapore" });
}
