"use client";

import { useEffect, useRef } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Props = {
  center: { lat: number; lng: number };
  zoom: number;
  onChange: (next: {
    center: { lat: number; lng: number };
    zoom: number;
  }) => void;
};

const hallIcon = L.divIcon({
  className: "dro-map-marker",
  html: `<span class="dro-map-marker-dot" style="width:16px;height:16px;background:var(--accent,#c72929);border:2px solid #fff;border-radius:999px;display:block;box-shadow:0 1px 4px rgba(31, 33, 38,.35)"></span>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function MapSync({
  center,
  zoom,
}: {
  center: { lat: number; lng: number };
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    const cur = map.getCenter();
    const z = map.getZoom();
    if (
      Math.abs(cur.lat - center.lat) > 1e-5 ||
      Math.abs(cur.lng - center.lng) > 1e-5 ||
      z !== zoom
    ) {
      map.setView([center.lat, center.lng], zoom, { animate: true });
    }
  }, [center.lat, center.lng, zoom, map]);
  return null;
}

function PinInteractions({
  center,
  onChange,
}: {
  center: { lat: number; lng: number };
  onChange: Props["onChange"];
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const centerRef = useRef(center);
  centerRef.current = center;

  const map = useMapEvents({
    click(e) {
      onChangeRef.current({
        center: { lat: e.latlng.lat, lng: e.latlng.lng },
        zoom: map.getZoom(),
      });
    },
    zoomend() {
      onChangeRef.current({
        center: { ...centerRef.current },
        zoom: map.getZoom(),
      });
    },
  });

  return (
    <Marker
      position={[center.lat, center.lng]}
      draggable
      icon={hallIcon}
      eventHandlers={{
        dragend(e) {
          const m = e.target as L.Marker;
          const ll = m.getLatLng();
          onChangeRef.current({
            center: { lat: ll.lat, lng: ll.lng },
            zoom: map.getZoom(),
          });
        },
      }}
    />
  );
}

/** Click or drag the pin to set the barangay hall location. */
export default function HallPinMap({ center, zoom, onChange }: Props) {
  return (
    <div className="relative h-[280px] w-full overflow-hidden border border-[var(--border)] sm:h-[340px]">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapSync center={center} zoom={zoom} />
        <PinInteractions center={center} onChange={onChange} />
      </MapContainer>
      <p className="pointer-events-none absolute bottom-2 left-2 z-[1000] border border-[var(--border)] bg-[var(--surface)]/95 px-2 py-1 font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase shadow-sm">
        Drag pin · or click map
      </p>
    </div>
  );
}
