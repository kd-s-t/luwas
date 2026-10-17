"use client";

import { useMemo } from "react";
import {
  APIProvider,
  AdvancedMarker,
  Map,
} from "@vis.gl/react-google-maps";
import {
  googleMapsApiKey,
  googleMapsMapId,
  hasGoogleMapsApiKey,
} from "@/lib/map/googleMapsConfig";
import type { SupplyCommunityRow } from "@/lib/workspace/supplyShortagePlan";
import { cn } from "@/lib/utils";

const COLORS = ["#c72929", "#3b6fb6", "#d97706", "#16794c", "#7c3aed"];

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

  if (!hasGoogleMapsApiKey()) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-[var(--border)] bg-[#f8fafc] text-sm text-[var(--muted)]">
        Map unavailable
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-[var(--border)] bg-[#f8fafc] text-sm text-[var(--muted)]">
        No mapped request points
      </div>
    );
  }

  return (
    <div className="relative min-h-[220px] overflow-hidden rounded-xl border border-[var(--border)] sm:min-h-[280px]">
      <APIProvider apiKey={googleMapsApiKey()} libraries={["marker"]}>
        <Map
          className="h-full min-h-[220px] w-full sm:min-h-[280px]"
          defaultCenter={center}
          defaultZoom={15}
          mapId={googleMapsMapId()}
          gestureHandling="cooperative"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          style={{ width: "100%", height: "100%" }}
        >
          {points.map((row, i) => {
            const color = COLORS[i % COLORS.length]!;
            return (
              <AdvancedMarker
                key={row.reportId}
                position={{ lat: row.lat, lng: row.lng }}
              >
                <div
                  className={cn(
                    "rounded-lg px-2 py-1 text-[11px] font-semibold text-white shadow-md",
                  )}
                  style={{ background: color }}
                >
                  {row.community.replace(/^Sitio\s+/i, "")}
                  <span className="ml-1 font-normal opacity-90">
                    Gap {row.gapL.toLocaleString("en-PH")} L
                  </span>
                </div>
              </AdvancedMarker>
            );
          })}
        </Map>
      </APIProvider>
    </div>
  );
}
