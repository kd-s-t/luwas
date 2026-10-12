"use client";

import { useEffect, useRef } from "react";
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

type PinRec = {
  marker: L.CircleMarker;
  lat: number;
  lng: number;
  priority: AssistPriority | null;
};

function pinStyle(priority: AssistPriority | null | undefined) {
  const color = priority ? PRIORITY_COLOR[priority] : HOUSEHOLD_DOT_GREEN;
  return {
    radius: priority ? 2.25 : 1.5,
    color: "#ffffff",
    weight: 0.75,
    opacity: 0.9,
    fillColor: color,
    fillOpacity: priority ? 0.95 : 0.7,
  } as const;
}

function rosterFingerprint(households: Household[]): string {
  // Id + coords only — ignore unrelated household field churn.
  let out = `${households.length}|`;
  for (const h of households) {
    if (h.lat == null || h.lng == null) continue;
    out += `${h.id}:${h.lat.toFixed(5)},${h.lng.toFixed(5)};`;
  }
  return out;
}

function prioritiesFingerprint(
  priorities: Record<string, AssistPriority>,
): string {
  const keys = Object.keys(priorities);
  if (keys.length === 0) return "";
  keys.sort();
  let out = "";
  for (const id of keys) out += `${id}:${priorities[id]};`;
  return out;
}

/**
 * Canvas house pin-points. Reuses the layer/canvas across renders and only
 * rebuilds markers when roster coords change; priority color updates in place.
 */
export function HouseholdPinsLayer({
  households,
  assistPriorities = {},
}: HouseholdPinsLayerProps) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);
  const canvasRef = useRef<L.Canvas | null>(null);
  const pinsRef = useRef<Map<string, PinRec>>(new Map());
  const rosterFpRef = useRef<string>("");
  const priorityFpRef = useRef<string>("");
  const householdsRef = useRef(households);
  const prioritiesRef = useRef(assistPriorities);
  householdsRef.current = households;
  prioritiesRef.current = assistPriorities;

  useEffect(() => {
    if (!map.getPane("householdsPane")) {
      map.createPane("householdsPane");
    }
    const hhPane = map.getPane("householdsPane");
    if (hhPane) hhPane.style.zIndex = "420";

    if (!groupRef.current) {
      groupRef.current = L.layerGroup([], { pane: "householdsPane" });
      canvasRef.current = L.canvas({ pane: "householdsPane", padding: 0.5 });
      map.addLayer(groupRef.current);
    }

    const group = groupRef.current;
    const canvasRenderer = canvasRef.current!;
    const pins = pinsRef.current;

    const rosterFp = rosterFingerprint(households);
    const priorityFp = prioritiesFingerprint(assistPriorities);
    const rosterChanged = rosterFp !== rosterFpRef.current;
    const priorityChanged = priorityFp !== priorityFpRef.current;

    if (!rosterChanged && !priorityChanged) return;

    if (rosterChanged) {
      group.clearLayers();
      pins.clear();

      for (const h of households) {
        if (h.lat == null || h.lng == null) continue;
        const priority = assistPriorities[h.id] ?? null;
        const marker = L.circleMarker([h.lat, h.lng], {
          renderer: canvasRenderer,
          pane: "householdsPane",
          ...pinStyle(priority),
        });

        // Bind popup only on first open - avoid 1.5k HTML strings up front.
        marker.on("click", () => {
          const row = householdsRef.current.find((x) => x.id === h.id) ?? h;
          const p = prioritiesRef.current[h.id];
          const elevM = estimateElevM(row.lat!, row.lng!);
          const priorityLine = p
            ? `<br/><span class="font-mono text-xs uppercase">AI · ${p}</span>`
            : "";
          const html = `<strong>${escapeHtml(row.ownerName)}</strong>${priorityLine}<br/><span class="font-mono text-xs">Elev ~${elevM.toFixed(0)} m</span><br/>${escapeHtml(row.purok)}<br/>${escapeHtml(row.address)}<br/><span class="font-mono text-xs">${escapeHtml(row.phone)}</span>`;
          if (marker.getPopup()) {
            marker.setPopupContent(html);
          } else {
            marker.bindPopup(html);
          }
          marker.openPopup();
        });

        group.addLayer(marker);
        pins.set(h.id, {
          marker,
          lat: h.lat,
          lng: h.lng,
          priority,
        });
      }

      rosterFpRef.current = rosterFp;
      priorityFpRef.current = priorityFp;
      return;
    }

    // Priority-only change: restyle existing markers, no tear-down.
    for (const [id, rec] of pins) {
      const next = assistPriorities[id] ?? null;
      if (next === rec.priority) continue;
      rec.marker.setStyle(pinStyle(next));
      rec.priority = next;
    }
    priorityFpRef.current = priorityFp;
  }, [map, households, assistPriorities]);

  useEffect(() => {
    return () => {
      const group = groupRef.current;
      if (group) {
        map.removeLayer(group);
        group.clearLayers();
      }
      groupRef.current = null;
      canvasRef.current = null;
      pinsRef.current.clear();
      rosterFpRef.current = "";
      priorityFpRef.current = "";
    };
  }, [map]);

  return null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
