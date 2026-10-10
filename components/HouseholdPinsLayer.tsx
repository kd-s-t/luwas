"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { AssistPriority } from "@/lib/ai/assistTypes";
import { estimateElevM } from "@/lib/geo/nangkaElevation";
import type { Household } from "@/lib/households/types";

type HouseholdPinsLayerProps = {
  households: Household[];
  assistPriorities?: Record<string, AssistPriority>;
};

/** Default house pins stay green; red is evacuate only. */
const HOUSEHOLD_DOT_GREEN = "#1f8f55";

const PRIORITY_COLOR: Record<AssistPriority, string> = {
  evacuate: "#c72929",
  prepare: "#b8860b",
  monitor: "#2563eb",
};

/**
 * Small canvas house pin-points (no clustering) — under hazard markers.
 */
export function HouseholdPinsLayer({
  households,
  assistPriorities = {},
}: HouseholdPinsLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!map.getPane("householdsPane")) {
      map.createPane("householdsPane");
    }
    const hhPane = map.getPane("householdsPane");
    if (hhPane) hhPane.style.zIndex = "420";

    const group = L.layerGroup([], { pane: "householdsPane" });
    const canvasRenderer = L.canvas({ pane: "householdsPane", padding: 0.5 });

    for (const h of households) {
      if (h.lat == null || h.lng == null) continue;
      const priority = assistPriorities[h.id];
      const color = priority ? PRIORITY_COLOR[priority] : HOUSEHOLD_DOT_GREEN;
      const radius = priority ? 2.25 : 1.5;
      const elevM = estimateElevM(h.lat, h.lng);

      const marker = L.circleMarker([h.lat, h.lng], {
        renderer: canvasRenderer,
        pane: "householdsPane",
        radius,
        color: "#ffffff",
        weight: 0.75,
        opacity: 0.9,
        fillColor: color,
        fillOpacity: priority ? 0.95 : 0.7,
      });

      const priorityLine = priority
        ? `<br/><span class="font-mono text-xs uppercase">AI · ${priority}</span>`
        : "";
      marker.bindPopup(
        `<strong>${escapeHtml(h.ownerName)}</strong>${priorityLine}<br/><span class="font-mono text-xs">Elev ~${elevM.toFixed(0)} m</span><br/>${escapeHtml(h.purok)}<br/>${escapeHtml(h.address)}<br/><span class="font-mono text-xs">${escapeHtml(h.phone)}</span>`,
      );
      group.addLayer(marker);
    }

    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      group.clearLayers();
    };
  }, [map, households, assistPriorities]);

  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
