"use client";

import { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet/hooks";
import L from "leaflet";
import type { FloodSample } from "@/lib/hazards/floodSamples";

/** Nangka elev-grid extent (matches nangkaElevationGrid). */
const SOUTH = 10.365;
const NORTH = 10.3765;
const WEST = 123.956;
const EAST = 123.9705;
const CANVAS_W = 768;
const CANVAS_H = 768;

function floodRgba(severity: FloodSample["severity"]): string {
  // Soft wash — map labels/roads stay readable (was too dark at ~0.6).
  if (severity === "critical") return "rgba(37, 99, 235, 0.28)";
  if (severity === "warning") return "rgba(59, 130, 246, 0.2)";
  return "rgba(96, 165, 250, 0.14)";
}

function footprintFingerprint(floods: FloodSample[]): string {
  let out = `${floods.length}|`;
  for (const fl of floods) {
    const n = fl.footprints?.length ?? (fl.footprint?.length ? 1 : 0);
    out += `${fl.id}:${fl.severity}:${n};`;
  }
  return out;
}

function projectX(lng: number) {
  return ((lng - WEST) / (EAST - WEST)) * CANVAS_W;
}
function projectY(lat: number) {
  return ((NORTH - lat) / (NORTH - SOUTH)) * CANVAS_H;
}

function paintFloodCanvas(floods: FloodSample[]): string | null {
  let cells = 0;
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  for (const fl of floods) {
    const rings = fl.footprints?.length
      ? fl.footprints
      : fl.footprint
        ? [fl.footprint]
        : [];
    ctx.fillStyle = floodRgba(fl.severity);
    for (const ring of rings) {
      if (ring.length < 3) continue;
      const lats = ring.map((p) => p.lat);
      const lngs = ring.map((p) => p.lng);
      const x0 = projectX(Math.min(...lngs));
      const x1 = projectX(Math.max(...lngs));
      const y0 = projectY(Math.max(...lats));
      const y1 = projectY(Math.min(...lats));
      const w = Math.max(2, x1 - x0);
      const h = Math.max(2, y1 - y0);
      ctx.fillRect(x0, y0, w, h);
      cells += 1;
    }
  }

  if (cells === 0) return null;
  return canvas.toDataURL("image/png");
}

/**
 * Blue elev-grid flood wash as a single ImageOverlay.
 * Survives canvas house-pin stacking that hid SVG polygons.
 */
export function FloodTilesLayer({ floods }: { floods: FloodSample[] }) {
  const map = useMap();
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const fpRef = useRef("");

  function sync() {
    const fp = footprintFingerprint(floods);
    const hasTiles = floods.some(
      (f) => (f.footprints?.length ?? 0) > 0 || Boolean(f.footprint?.length),
    );

    if (!hasTiles) {
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
        overlayRef.current = null;
      }
      fpRef.current = fp;
      return;
    }

    if (fp === fpRef.current && overlayRef.current && map.hasLayer(overlayRef.current)) {
      return;
    }
    fpRef.current = fp;

    const url = paintFloodCanvas(floods);
    if (!url) return;

    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }

    const overlay = L.imageOverlay(
      url,
      [
        [SOUTH, WEST],
        [NORTH, EAST],
      ],
      {
        opacity: 1,
        interactive: false,
        className: "luwas-flood-tiles",
        zIndex: 450,
      },
    );
    overlay.addTo(map);
    overlayRef.current = overlay;
  }

  useEffect(() => {
    sync();
    return () => {
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
        overlayRef.current = null;
      }
      fpRef.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync reads floods
  }, [map, floods]);

  useMapEvents({
    // Re-assert overlay if another layer wipe removed it.
    overlayadd: () => {
      if (
        overlayRef.current &&
        !map.hasLayer(overlayRef.current) &&
        fpRef.current
      ) {
        overlayRef.current.addTo(map);
      }
    },
  });

  return null;
}
