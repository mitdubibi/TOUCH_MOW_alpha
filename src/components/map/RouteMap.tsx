"use client";

import dynamic from "next/dynamic";

// Leaflet needs the browser, so the map only loads on the client.
export const RouteMap = dynamic(() => import("./RouteMapInner"), {
  ssr: false,
  loading: () => <div className="h-[380px] animate-pulse rounded-xl bg-slate-200" />,
});

export type { RouteMapProps, RouteMapStop, RouteMapVolunteer } from "./RouteMapInner";
