"use client";

import { useEffect, useMemo } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
  Polyline,
  useMap,
} from "@vis.gl/react-google-maps";
import type { AssistEscapeRoute } from "@/lib/ai/assistTypes";
import {
  bearingDegrees,
  compassLabel,
  distKm,
} from "@/lib/geo/bearing";
import { DEFAULT_MAP_AREA } from "@/lib/geo/mapAreas";
import { commandHallPoint } from "@/lib/geo/safePoints";
import { useRoadEscapes } from "@/lib/geo/useRoadEscapes";
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

function directionsUrl(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}

function routesFromHall(
  hall: { lat: number; lng: number },
  points: (SupplyCommunityRow & { lat: number; lng: number })[],
): AssistEscapeRoute[] {
  return points.map((row) => {
    const from = { lat: hall.lat, lng: hall.lng };
    const to = { lat: row.lat, lng: row.lng };
    const bearing = bearingDegrees(from, to);
    const distanceKm = distKm(from, to);
    const direction = compassLabel(bearing);
    return {
      householdId: `hall-${row.reportId}`,
      from,
      to,
      destinationId: row.reportId,
      destinationName: row.community.trim() || "Community",
      bearing,
      direction,
      distanceKm,
      instruction: `${direction} · ${distanceKm.toFixed(1)} km from Brgy. Hall`,
      path: [from, to],
      routed: false,
    };
  });
}

function GapChips({
  points,
  hall,
  routes,
}: {
  points: (SupplyCommunityRow & { lat: number; lng: number })[];
  hall: { lat: number; lng: number };
  routes: AssistEscapeRoute[];
}) {
  const byId = useMemo(() => {
    const m = new Map<string, AssistEscapeRoute>();
    for (const r of routes) m.set(r.destinationId, r);
    return m;
  }, [routes]);

  return (
    <div className="flex flex-wrap gap-2">
      {points.map((row, i) => {
        const route = byId.get(row.reportId);
        const km = route?.distanceKm;
        return (
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
            {km != null ? (
              <span className="ml-1.5 text-[var(--muted)]">
                · {km.toFixed(1)} km
              </span>
            ) : null}
            <a
              href={directionsUrl(hall, { lat: row.lat, lng: row.lng })}
              target="_blank"
              rel="noreferrer"
              className="ml-1.5 font-medium text-[#2f5f9e] hover:underline"
            >
              Directions
            </a>
          </div>
        );
      })}
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
  const hall = useMemo(() => commandHallPoint(DEFAULT_MAP_AREA), []);

  const points = useMemo(
    () =>
      rows.filter(
        (r): r is SupplyCommunityRow & { lat: number; lng: number } =>
          r.lat != null && r.lng != null,
      ),
    [rows],
  );

  const crowRoutes = useMemo(
    () => routesFromHall(hall, points),
    [hall, points],
  );
  const mapRoutes = useRoadEscapes(crowRoutes, { deferMs: 200 });

  const fitPoints = useMemo(
    () => [{ lat: hall.lat, lng: hall.lng }, ...points],
    [hall, points],
  );

  const center = useMemo(() => {
    if (fitPoints.length === 0) return { lat: hall.lat, lng: hall.lng };
    const lat = fitPoints.reduce((s, p) => s + p.lat, 0) / fitPoints.length;
    const lng = fitPoints.reduce((s, p) => s + p.lng, 0) / fitPoints.length;
    return { lat, lng };
  }, [fitPoints, hall]);

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
        <GapChips points={points} hall={hall} routes={crowRoutes} />
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
            <FitAllMarkers points={fitPoints} />
            {mapRoutes.map((route) => {
              const path =
                route.path.length >= 2 ? route.path : [route.from, route.to];
              const alongRoads = route.routed && route.path.length > 2;
              return (
                <Polyline
                  key={`dir-${route.destinationId}-${alongRoads ? "road" : "fly"}`}
                  path={path}
                  strokeColor="#2f5f9e"
                  strokeWeight={alongRoads ? 4 : 3}
                  strokeOpacity={alongRoads ? 0.92 : 0}
                  icons={
                    alongRoads
                      ? undefined
                      : [
                          {
                            icon: {
                              path: "M 0,-1 0,1",
                              strokeOpacity: 0.55,
                              strokeColor: "#2f5f9e",
                              scale: 3,
                            },
                            offset: "0",
                            repeat: "14px",
                          },
                        ]
                  }
                />
              );
            })}
            <AdvancedMarker position={{ lat: hall.lat, lng: hall.lng }}>
              <div className="relative flex flex-col items-center">
                <div
                  className="absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#64748b]/35"
                  aria-hidden
                />
                <div className="relative z-[1] rounded-md bg-[#334155] px-2 py-1 text-center text-[11px] font-semibold text-white shadow-md">
                  Brgy. Hall
                </div>
              </div>
            </AdvancedMarker>
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
      <p className="text-[12px] text-[var(--muted)]">
        Routes from Brgy. Hall · tap Directions for Google Maps
      </p>
      <GapChips points={points} hall={hall} routes={mapRoutes} />
    </div>
  );
}
