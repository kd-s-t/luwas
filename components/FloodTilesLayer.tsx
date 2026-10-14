"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import type { FloodSample } from "@/lib/hazards/floodSamples";

/** Nangka elev-grid extent (matches nangkaElevationGrid). */
const SOUTH = 10.365;
const NORTH = 10.3765;
const WEST = 123.956;
const EAST = 123.9705;
const CANVAS_W = 768;
const CANVAS_H = 768;

function floodRgba(severity: FloodSample["severity"]): string {
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
 * Blue elev-grid flood wash as a GroundOverlay on Google Maps.
 */
export function FloodTilesLayer({ floods }: { floods: FloodSample[] }) {
  const map = useMap();
  const overlayRef = useRef<google.maps.GroundOverlay | null>(null);
  const fpRef = useRef("");

  useEffect(() => {
    if (!map) return;

    const fp = footprintFingerprint(floods);
    const hasTiles = floods.some(
      (f) => (f.footprints?.length ?? 0) > 0 || Boolean(f.footprint?.length),
    );

    if (!hasTiles) {
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
      fpRef.current = fp;
      return;
    }

    if (fp === fpRef.current && overlayRef.current) return;
    fpRef.current = fp;

    const url = paintFloodCanvas(floods);
    if (!url) return;

    overlayRef.current?.setMap(null);
    const bounds = new google.maps.LatLngBounds(
      { lat: SOUTH, lng: WEST },
      { lat: NORTH, lng: EAST },
    );
    const overlay = new google.maps.GroundOverlay(url, bounds, {
      opacity: 0.85,
      clickable: false,
    });
    overlay.setMap(map);
    overlayRef.current = overlay;

    return () => {
      overlay.setMap(null);
      if (overlayRef.current === overlay) overlayRef.current = null;
    };
  }, [map, floods]);

  useEffect(() => {
    return () => {
      overlayRef.current?.setMap(null);
      overlayRef.current = null;
      fpRef.current = "";
    };
  }, []);

  return null;
}
