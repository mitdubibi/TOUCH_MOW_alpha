"use client";

import dynamic from "next/dynamic";
import { CENTRE } from "@/data/mockData";
import type { MapPin } from "./DemoMapInner";

// Leaflet needs the browser, so the map only loads on the client.
export const DemoMap = dynamic(() => import("./DemoMapInner"), {
  ssr: false,
  loading: () => <div className="h-[380px] animate-pulse rounded-xl bg-navy/10" />,
});

export type { MapPin } from "./DemoMapInner";

export const CENTRE_PIN: MapPin = {
  id: "centre",
  lat: CENTRE.lat,
  lng: CENTRE.lng,
  label: "Start",
  variant: "centre",
  title: CENTRE.name,
};
