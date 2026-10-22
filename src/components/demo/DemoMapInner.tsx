"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip } from "react-leaflet";
import type { LatLng } from "@/lib/demo/route";

export type MapPin = LatLng & {
  id: string;
  label: string;
  variant: "stop" | "done" | "centre" | "volunteer" | "block";
  colour?: string;
  title?: string;
};

const SIZE = { stop: 32, done: 28, centre: 34, volunteer: 38, block: 30 };

function icon(pin: MapPin) {
  const size = SIZE[pin.variant];
  const style: Record<MapPin["variant"], string> = {
    stop: "background:#12263F;color:#FFC20E;font-size:15px",
    done: "background:#94a3b8;color:#fff;font-size:14px",
    centre: "background:#FFC20E;color:#12263F;font-size:11px;border-radius:8px",
    volunteer: `background:${pin.colour};color:#fff;font-size:13px;border-width:3px`,
    block: `background:${pin.colour ?? "#64748b"};color:#fff;font-size:12px`,
  };
  return L.divIcon({
    className: "",
    html: `<div class="map-pin" style="width:${size}px;height:${size}px;${style[pin.variant]}">${pin.label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function DemoMapInner({ pins, path, height = 380 }: { pins: MapPin[]; path?: LatLng[]; height?: number }) {
  const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number]));
  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={{ padding: [36, 36] }}
      scrollWheelZoom={false}
      style={{ height, width: "100%" }}
      className="rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {path && path.length > 1 && (
        <Polyline
          positions={path.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{ color: "#12263F", weight: 4, opacity: 0.8, dashArray: "8 8" }}
        />
      )}
      {pins.map((pin) => (
        <Marker key={pin.id} position={[pin.lat, pin.lng]} icon={icon(pin)} zIndexOffset={pin.variant === "volunteer" ? 1000 : 0}>
          {pin.title && <Tooltip direction="top" offset={[0, -14]}>{pin.title}</Tooltip>}
        </Marker>
      ))}
    </MapContainer>
  );
}
