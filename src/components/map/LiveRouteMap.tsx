"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RouteMap, type RouteMapProps, type RouteMapVolunteer } from "./RouteMap";

type LocationRow = { volunteer_id: string; lat: number; lng: number };

type Props = Omit<RouteMapProps, "volunteers"> & {
  sessionId: string;
  initialVolunteers: RouteMapVolunteer[];
  // volunteer id -> display name, for positions that arrive live.
  names: Record<string, string>;
};

// Route map plus volunteers' live positions, pushed by Supabase realtime as they share.
export function LiveRouteMap({ sessionId, initialVolunteers, names, ...map }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [volunteers, setVolunteers] = useState(initialVolunteers);

  useEffect(() => {
    const channel = supabase
      .channel(`locations:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "volunteer_locations", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const gone = (payload.old as Partial<LocationRow>).volunteer_id;
            setVolunteers((prev) => prev.filter((v) => v.id !== gone));
            return;
          }
          const row = payload.new as LocationRow;
          const next = { id: row.volunteer_id, name: names[row.volunteer_id] ?? "Volunteer", lat: row.lat, lng: row.lng };
          setVolunteers((prev) => [...prev.filter((v) => v.id !== next.id), next]);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, sessionId, names]);

  return <RouteMap {...map} volunteers={volunteers} />;
}
