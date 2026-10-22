"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from "react-leaflet";
import type { LatLng } from "@/lib/route/optimise";

export type RouteMapStop = LatLng & { stopNo: number; blockNo: string; units: number; done: boolean };
export type RouteMapVolunteer = LatLng & { id: string; name: string };

export type RouteMapProps = {
  centre: LatLng & { name: string };
  stops: RouteMapStop[];
  path: LatLng[];
  // Live positions of volunteers who are sharing.
  volunteers?: RouteMapVolunteer[];
  height?: number;
};

// OneMap basemap. Their terms ask for this attribution with the logo.
const ONEMAP_TILES = "https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png";
const ONEMAP_ATTRIBUTION =
  '<img src="https://www.onemap.gov.sg/web-assets/images/logo/om_logo.png" style="height:20px;width:20px;display:inline" alt=""/>' +
  '&nbsp;<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a>' +
  '&nbsp;&copy;&nbsp;contributors&nbsp;&#124;&nbsp;<a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>';
const SINGAPORE: L.LatLngBoundsExpression = [
  [1.144, 103.535],
  [1.494, 104.502],
];

function pin(label: string, size: number, style: string) {
  return L.divIcon({
    className: "",
    html: `<div class="map-pin" style="width:${size}px;height:${size}px;${style}">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const centreIcon = pin("Start", 38, "background:#FFC20E;color:#12263F;font-size:12px;border-radius:8px");
const stopIcon = (n: number) => pin(String(n), 34, "background:#12263F;color:#FFC20E;font-size:16px");
const doneIcon = pin("✓", 30, "background:#94a3b8;color:#fff;font-size:15px");
const volunteerIcon = (name: string) =>
  pin(/^[a-z0-9]/i.test(name.trim()) ? name.trim().charAt(0).toUpperCase() : "V", 38, "background:#0f766e;color:#fff;font-size:16px;border-width:3px");

export default function RouteMapInner({ centre, stops, path, volunteers = [], height = 380 }: RouteMapProps) {
  const bounds = L.latLngBounds([centre, ...stops, ...path].map((p) => [p.lat, p.lng] as [number, number]));
  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [36, 36] }}
      maxBounds={SINGAPORE}
      minZoom={11}
      maxZoom={19}
      scrollWheelZoom={false}
      style={{ height, width: "100%" }}
      className="rounded-xl"
    >
      <TileLayer url={ONEMAP_TILES} attribution={ONEMAP_ATTRIBUTION} minZoom={11} maxZoom={19} detectRetina />
      {path.length > 1 && (
        <Polyline
          positions={path.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{ color: "#12263F", weight: 5, opacity: 0.75 }}
        />
      )}
      <Marker position={[centre.lat, centre.lng]} icon={centreIcon}>
        <Tooltip direction="top" offset={[0, -16]}>
          {centre.name}
        </Tooltip>
      </Marker>
      {stops.map((s) => (
        <Marker
          key={s.stopNo}
          position={[s.lat, s.lng]}
          icon={s.done ? doneIcon : stopIcon(s.stopNo)}
          zIndexOffset={s.done ? 0 : 500 - s.stopNo}
        >
          <Tooltip direction="top" offset={[0, -16]}>
            Stop {s.stopNo}: Blk {s.blockNo} ({s.units} {s.units === 1 ? "meal" : "meals"})
          </Tooltip>
        </Marker>
      ))}
      {volunteers.map((v) => (
        <Marker key={v.id} position={[v.lat, v.lng]} icon={volunteerIcon(v.name)} zIndexOffset={1000}>
          <Tooltip direction="top" offset={[0, -18]}>
            {v.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
