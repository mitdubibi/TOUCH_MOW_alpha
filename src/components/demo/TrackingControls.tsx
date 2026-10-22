"use client";

import { useDemo } from "./DemoProvider";

// Volunteer session screen: share real GPS every 30 seconds, or simulate walking the route
// (for testing indoors). Recipients' ETAs and the organiser's live map follow this position.
export function TrackingControls({ sessionId }: { sessionId: string }) {
  const { state, tracking, startTracking, stopTracking } = useDemo();
  const mine = tracking && tracking.sessionId === sessionId && tracking.volunteerId === state.volunteerId;

  if (tracking && !mine) {
    return (
      <div className="rounded-2xl bg-navy/5 p-3 text-sm text-navy">
        This tab is already sharing a location for another session or volunteer.{" "}
        <button type="button" onClick={stopTracking} className="font-semibold underline">
          Stop it
        </button>
      </div>
    );
  }

  if (mine) {
    return (
      <div className="space-y-2 rounded-2xl border-2 border-navy bg-sun-light p-3" aria-live="polite">
        <p className="flex items-center gap-2 font-bold text-navy">
          <span className="h-3 w-3 animate-pulse rounded-full bg-green-600" aria-hidden />
          {tracking.mode === "gps" ? "Sharing your location" : "Simulated walking"}
        </p>
        <p className="text-sm text-navy">{tracking.note}</p>
        <button type="button" onClick={stopTracking} className="w-full rounded-xl border-2 border-navy py-2 font-semibold text-navy">
          {tracking.mode === "gps" ? "Stop sharing" : "Stop walking"}
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[2fr_1fr] gap-2">
      <button
        type="button"
        onClick={() => startTracking(sessionId, "gps")}
        className="rounded-2xl bg-navy py-3 text-lg font-bold text-sun"
      >
        ▶ Start delivery
      </button>
      <button
        type="button"
        onClick={() => startTracking(sessionId, "sim")}
        className="rounded-2xl border-2 border-navy py-3 text-sm font-semibold leading-tight text-navy"
      >
        Simulate walking
      </button>
    </div>
  );
}
