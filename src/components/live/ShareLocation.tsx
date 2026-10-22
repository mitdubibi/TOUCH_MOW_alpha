"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { startDelivery, stopSharing } from "@/app/volunteer/session/[id]/actions";
import { createClient } from "@/lib/supabase/client";

type Props = {
  sessionId: string;
  // Already sharing when the page loaded (e.g. after a reload): carry on without asking again.
  initialSharing: boolean;
  ended: boolean;
};

const SEND_EVERY_MS = 30_000;

function geoErrorText(err: GeolocationPositionError) {
  if (err.code === err.PERMISSION_DENIED) return "Location is blocked. Allow location for this site in your browser settings.";
  return "Could not find your location. Move near a window or outside.";
}

const timeLabel = (d: Date) => d.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit", second: "2-digit" });

export function ShareLocation({ sessionId, initialSharing, ended: initialEnded }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [ended, setEnded] = useState(initialEnded);
  const [sharing, setSharing] = useState(initialSharing && !initialEnded);
  const [busy, setBusy] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const latest = useRef<GeolocationPosition | null>(null);

  // While sharing: keep GPS on and send the newest position every 30 seconds.
  useEffect(() => {
    if (!sharing) return;
    let stopped = false;
    let sentOnce = false;
    let lock: WakeLockSentinel | null = null;

    const send = async () => {
      const pos = latest.current;
      if (!pos || stopped) return;
      sentOnce = true;
      const { data, error } = await supabase.rpc("share_location", {
        p_session_id: sessionId,
        p_lat: pos.coords.latitude,
        p_lng: pos.coords.longitude,
        p_accuracy_m: pos.coords.accuracy,
      });
      if (stopped) return;
      if (error) {
        // Probably no signal. The next try is in 30 seconds.
        setMessage(`Location not sent: ${error.message}`);
        return;
      }
      if (data === false) {
        setSharing(false);
        setMessage("Location sharing stopped. The session may have ended.");
        return;
      }
      setMessage(null);
      setLastSent(new Date());
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        latest.current = pos;
        if (!sentOnce) void send();
      },
      (err) => setMessage(geoErrorText(err)),
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    );
    void send();
    const timer = setInterval(send, SEND_EVERY_MS);

    // Keep the screen on so the phone does not pause sharing. Asked again when the page comes back.
    const keepAwake = () => {
      if (document.visibilityState === "visible") {
        navigator.wakeLock
          ?.request("screen")
          .then((l) => (lock = l))
          .catch(() => {});
      }
    };
    keepAwake();
    document.addEventListener("visibilitychange", keepAwake);

    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", keepAwake);
      void lock?.release().catch(() => {});
    };
  }, [sharing, supabase, sessionId]);

  // The session ends when the organiser ends it or the last unit is ticked: stop at once.
  useEffect(() => {
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          if ((payload.new as { status: string }).status !== "done") return;
          setSharing(false);
          setEnded(true);
          setMessage(null);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, sessionId]);

  async function start() {
    setMessage(null);
    if (!window.isSecureContext || !("geolocation" in navigator)) {
      setMessage("Location only works on a secure (https) link or on localhost.");
      return;
    }
    setBusy(true);
    // Ask for location first, so a refusal does not start the session.
    const pos = await new Promise<GeolocationPosition | null>((resolve) =>
      navigator.geolocation.getCurrentPosition(resolve, (err) => {
        setMessage(geoErrorText(err));
        resolve(null);
      }, { enableHighAccuracy: true, timeout: 20_000 }),
    );
    if (!pos) {
      setBusy(false);
      return;
    }
    const res = await startDelivery(sessionId);
    setBusy(false);
    if (res.error) {
      setMessage(res.error);
      return;
    }
    latest.current = pos;
    setSharing(true);
  }

  async function stop() {
    setBusy(true);
    const res = await stopSharing(sessionId);
    setBusy(false);
    if (res.error) setMessage(res.error);
    else setSharing(false);
  }

  if (ended) {
    return <p className="rounded-xl bg-slate-100 px-4 py-3 text-slate-700">This session has ended. Location sharing is off.</p>;
  }

  return (
    <div className="space-y-2">
      {sharing ? (
        <div className="space-y-3 rounded-xl border-2 border-teal-700 bg-teal-50 px-4 py-3">
          <p className="flex items-center gap-2 text-lg font-bold text-teal-900">
            <span className="h-3 w-3 animate-pulse rounded-full bg-teal-600" aria-hidden />
            Sharing your location
          </p>
          <p className="text-sm text-teal-900">
            {lastSent ? `Last sent ${timeLabel(lastSent)}.` : "Finding your location..."} Recipients see how many stops
            away you are. Sharing stops when the session ends.
          </p>
          <button
            type="button"
            onClick={stop}
            disabled={busy}
            className="w-full rounded-lg border-2 border-teal-800 bg-white px-4 py-2 font-semibold text-teal-900 disabled:opacity-50"
          >
            Stop sharing
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="w-full rounded-xl bg-teal-700 px-4 py-4 text-xl font-bold text-white disabled:opacity-50"
          >
            {busy ? "Starting..." : "Start delivery"}
          </button>
          <p className="text-sm text-slate-600">
            Shares your location every 30 seconds so recipients know when their meal will arrive. Stops when the session
            ends.
          </p>
        </>
      )}
      {message && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {message}
        </p>
      )}
    </div>
  );
}
