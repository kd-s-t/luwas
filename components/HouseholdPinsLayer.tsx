"use client";

import { useMemo, useState } from "react";
import { Circle, InfoWindow } from "@vis.gl/react-google-maps";
import type { AssistPriority } from "@/lib/ai/assistTypes";
import { estimateElevM } from "@/lib/geo/nangkaElevation";
import type { Household } from "@/lib/households/types";

type HouseholdPinsLayerProps = {
  households: Household[];
  assistPriorities?: Record<string, AssistPriority>;
};

const HOUSEHOLD_DOT_GREEN = "#1f8f55";

const PRIORITY_COLOR: Record<AssistPriority, string> = {
  evacuate: "#c72929",
  prepare: "#b8860b",
  monitor: "#2563eb",
};

/** Screen-ish radius in metres at typical barangay zoom (~15–16). */
const RADIUS_DEFAULT_M = 4;
const RADIUS_PRIORITY_M = 6;

type PinRow = {
  id: string;
  lat: number;
  lng: number;
  priority: AssistPriority | null;
  ownerName: string;
  purok: string;
  address: string;
  phone: string;
};

/**
 * Household pin-points as Google Maps Circles (fixed-ish metres at ops zoom).
 */
export function HouseholdPinsLayer({
  households,
  assistPriorities = {},
}: HouseholdPinsLayerProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const pins = useMemo(() => {
    const out: PinRow[] = [];
    for (const h of households) {
      if (h.lat == null || h.lng == null) continue;
      out.push({
        id: h.id,
        lat: h.lat,
        lng: h.lng,
        priority: assistPriorities[h.id] ?? null,
        ownerName: h.ownerName,
        purok: h.purok,
        address: h.address,
        phone: h.phone,
      });
    }
    return out;
  }, [households, assistPriorities]);

  const openPin = openId ? pins.find((p) => p.id === openId) : null;

  return (
    <>
      {pins.map((p) => {
        const color = p.priority
          ? PRIORITY_COLOR[p.priority]
          : HOUSEHOLD_DOT_GREEN;
        const radius = p.priority ? RADIUS_PRIORITY_M : RADIUS_DEFAULT_M;
        return (
          <Circle
            key={p.id}
            center={{ lat: p.lat, lng: p.lng }}
            radius={radius}
            onClick={() => setOpenId(p.id)}
            strokeColor="#ffffff"
            strokeOpacity={0.9}
            strokeWeight={1}
            fillColor={color}
            fillOpacity={p.priority ? 0.95 : 0.7}
            clickable
            zIndex={p.priority ? 430 : 420}
          />
        );
      })}
      {openPin ? (
        <InfoWindow
          position={{ lat: openPin.lat, lng: openPin.lng }}
          onCloseClick={() => setOpenId(null)}
          headerDisabled
        >
          <div className="dro-gmap-popup">
            <button
              type="button"
              className="dro-gmap-popup-close"
              aria-label="Close"
              onClick={() => setOpenId(null)}
            >
              ×
            </button>
            <strong>{openPin.ownerName}</strong>
            {openPin.priority ? (
              <>
                <br />
                <span className="font-mono text-xs uppercase">
                  AI · {openPin.priority}
                </span>
              </>
            ) : null}
            <br />
            <span className="font-mono text-xs">
              Elev ~{estimateElevM(openPin.lat, openPin.lng).toFixed(0)} m
            </span>
            <br />
            {openPin.purok}
            <br />
            {openPin.address}
            <br />
            <span className="font-mono text-xs">{openPin.phone}</span>
          </div>
        </InfoWindow>
      ) : null}
    </>
  );
}
