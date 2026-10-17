"use client";

import { useEffect, useMemo } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import {
  googleMapsApiKey,
  googleMapsMapId,
  hasGoogleMapsApiKey,
} from "@/lib/map/googleMapsConfig";
import type { SupplyCommunityRow } from "@/lib/workspace/supplyShortagePlan";

const COLORS = ["#e11d48", "#2563eb", "#d97706", "#16794c", "#7c3aed"];
const TINTS = [
  "rgba(225, 29, 72, 0.28)",
  "rgba(37, 99, 235, 0.28)",
  "rgba(217, 119, 6, 0.28)",
  "rgba(22, 121, 76, 0.28)",
  "rgba(124, 58, 237, 0.28)",
];

function sitioLabel(row: SupplyCommunityRow): string {
  const name = row.community.trim() || "Sitio";
  return `${name}, ${row.gapL.toLocaleString("en-PH")} L`;
}

function GapChips({
  points,
}: {
  points: (SupplyCommunityRow & { lat: number; lng: number })[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {points.map((row, i) => (
        <div
          key={row.reportId}
          className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[12px] shadow-sm"
        >
          <span
            className="mr-1.5 inline-block size-2 rounded-full align-middle"
            style={{ background: COLORS[i % COLORS.length] }}
            aria-hidden
          />
          <span className="font-medium text-[var(--foreground)]">
            {sitioLabel(row)}
          </span>
        </div>
      ))}
    </div>
  );
}

function FitAllMarkers({
  points,
}: {
  points: { lat: number; lng: number }[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || points.length === 0) return;
    if (points.length === 1) {
      const only = points[0]!;
      map.setCenter({ lat: only.lat, lng: only.lng });
      map.setZoom(15);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const p of points) {
      bounds.extend({ lat: p.lat, lng: p.lng });
    }
    map.fitBounds(bounds, 72);
  }, [map, points]);

  return null;
}

export function ShortagePlanMap({ rows }: { rows: SupplyCommunityRow[] }) {
  const points = useMemo(
    () =>
      rows.filter(
        (r): r is SupplyCommunityRow & { lat: number; lng: number } =>
          r.lat != null && r.lng != null,
      ),
    [rows],
  );

  const center = useMemo(() => {
    if (points.length === 0) return { lat: 10.3375, lng: 123.905 };
    const lat = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.lng, 0) / points.length;
    return { lat, lng };
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-[var(--border)] bg-[#f8fafc] text-sm text-[var(--muted)]">
        No mapped request points
      </div>
    );
  }

  if (!hasGoogleMapsApiKey()) {
    return (
      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[#f8fafc] p-4">
        <p className="text-sm text-[var(--muted)]">Map unavailable</p>
        <GapChips points={points} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative h-[300px] overflow-hidden rounded-xl border border-[var(--border)]">
        <APIProvider apiKey={googleMapsApiKey()} libraries={["marker"]}>
          <Map
            className="h-full w-full"
            defaultCenter={center}
            defaultZoom={14}
            mapId={googleMapsMapId()}
            gestureHandling="greedy"
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            style={{ width: "100%", height: "100%" }}
          >
            <FitAllMarkers points={points} />
            {points.map((row, i) => {
              const color = COLORS[i % COLORS.length]!;
              const tint = TINTS[i % TINTS.length]!;
              return (
                <AdvancedMarker
                  key={row.reportId}
                  position={{ lat: row.lat, lng: row.lng }}
                >
                  <div className="relative flex flex-col items-center">
                    <div
                      className="absolute top-1/2 left-1/2 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ background: tint }}
                      aria-hidden
                    />
                    <div
                      className="relative z-[1] max-w-[160px] rounded-md px-2 py-1 text-center text-[11px] font-semibold text-white shadow-md"
                      style={{ background: color }}
                    >
                      {sitioLabel(row)}
                    </div>
                  </div>
                </AdvancedMarker>
              );
            })}
          </Map>
        </APIProvider>
      </div>
      <GapChips points={points} />
    </div>
  );
}
