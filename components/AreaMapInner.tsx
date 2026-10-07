"use client";

import { Fragment, useEffect } from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { AssistEscapeRoute, AssistPriority } from "@/lib/ai/assistTypes";
import { CEBU_AREA } from "@/lib/geo/cebu";
import { NANGKA_SAFE_POINTS } from "@/lib/geo/safePoints";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import { floodSeverityLabel } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import { landslideSeverityLabel } from "@/lib/hazards/landslideSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";
import { typhoonCategoryLabel } from "@/lib/hazards/typhoonSamples";
import type { QuakeEvent } from "@/lib/hazards/usgsEarthquakes";
import type { Household } from "@/lib/households/types";
import "leaflet/dist/leaflet.css";

const houseIcon = L.divIcon({
  className: "dro-map-marker",
  html: "<span class='dro-map-marker-dot'></span>",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function priorityHouseIcon(priority: AssistPriority) {
  return L.divIcon({
    className: "dro-map-marker",
    html: `<span class="dro-map-marker-dot dro-map-marker-dot-ai dro-map-marker-dot-ai-${priority}"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const hallIcon = L.divIcon({
  className: "dro-map-marker dro-map-marker-hall",
  html: "<span class='dro-map-marker-dot dro-map-marker-dot-hall'></span>",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function quakeIcon(mag: number | null) {
  const m = mag ?? 0;
  const size = m >= 5 ? 18 : m >= 4 ? 15 : 12;
  return L.divIcon({
    className: "dro-map-marker",
    html: `<span class="dro-map-marker-dot dro-map-marker-dot-quake" style="width:${size}px;height:${size}px"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function landslideIcon(severity: LandslideSample["severity"]) {
  return L.divIcon({
    className: "dro-map-marker",
    html: `<span class="dro-map-marker-slide dro-map-marker-slide-${severity}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function floodIcon(severity: FloodSample["severity"]) {
  return L.divIcon({
    className: "dro-map-marker",
    html: `<span class="dro-map-marker-flood dro-map-marker-flood-${severity}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

/** Classic tropical cyclone / typhoon spiral (eye + rainbands). */
const TYPHOON_SVG = `<svg class="dro-map-marker-typhoon" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <circle cx="16" cy="16" r="14" fill="#dbeafe" stroke="#1d4ed8" stroke-width="1.5"/>
  <path fill="#2563eb" d="M16 4c4.2 1.2 7.5 4.2 8.8 8.2-2.8-1.8-6-2.6-8.8-2.4V4z"/>
  <path fill="#1d4ed8" d="M28 16c-1.2 4.2-4.2 7.5-8.2 8.8 1.8-2.8 2.6-6 2.4-8.8H28z"/>
  <path fill="#3b82f6" d="M16 28c-4.2-1.2-7.5-4.2-8.8-8.2 2.8 1.8 6 2.6 8.8 2.4V28z"/>
  <path fill="#60a5fa" d="M4 16c1.2-4.2 4.2-7.5 8.2-8.8-1.8 2.8-2.6 6-2.4 8.8H4z"/>
  <circle cx="16" cy="16" r="4.2" fill="#ffffff" stroke="#1e40af" stroke-width="1.5"/>
  <circle cx="16" cy="16" r="1.6" fill="#1e40af"/>
</svg>`;

function typhoonIcon() {
  return L.divIcon({
    className: "dro-map-marker dro-map-marker-typhoon-wrap",
    html: TYPHOON_SVG,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function escapeArrowIcon(bearing: number) {
  return L.divIcon({
    className: "dro-map-marker dro-map-escape-arrow-wrap",
    html: `<span class="dro-map-escape-arrow" style="transform:rotate(${bearing}deg)"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const shelterIcon = L.divIcon({
  className: "dro-map-marker",
  html: "<span class='dro-map-marker-dot dro-map-marker-dot-shelter'></span>",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function FitHouseholds({
  households,
  highlightIds,
  escapeRoutes,
}: {
  households: Household[];
  highlightIds: string[];
  escapeRoutes: AssistEscapeRoute[];
}) {
  const map = useMap();

  useEffect(() => {
    const focus =
      highlightIds.length > 0
        ? households.filter(
            (h) =>
              highlightIds.includes(h.id) && h.lat != null && h.lng != null,
          )
        : households.filter((h) => h.lat != null && h.lng != null);

    const points: [number, number][] = [
      [CEBU_AREA.center.lat, CEBU_AREA.center.lng],
    ];
    for (const h of focus) {
      points.push([h.lat!, h.lng!]);
    }
    for (const r of escapeRoutes) {
      const path = r.path?.length ? r.path : [r.from, r.to];
      for (const p of path) {
        points.push([p.lat, p.lng]);
      }
    }

    if (points.length <= 1 && focus.length === 0) {
      map.setView(
        [CEBU_AREA.center.lat, CEBU_AREA.center.lng],
        CEBU_AREA.zoom,
      );
      return;
    }

    const bounds = L.latLngBounds(points);
    map.fitBounds(
      bounds.pad(highlightIds.length || escapeRoutes.length ? 0.55 : 0.35),
    );
  }, [households, highlightIds, escapeRoutes, map]);

  return null;
}

type AreaMapInnerProps = {
  households: Household[];
  quakes: QuakeEvent[];
  landslides: LandslideSample[];
  floods: FloodSample[];
  typhoons: TyphoonSample[];
  /** householdId → AI priority — updates marker style + map focus */
  assistPriorities?: Record<string, AssistPriority>;
  escapeRoutes?: AssistEscapeRoute[];
};

export default function AreaMapInner({
  households,
  quakes,
  landslides,
  floods,
  typhoons,
  assistPriorities = {},
  escapeRoutes = [],
}: AreaMapInnerProps) {
  const mapped = households.filter((h) => h.lat != null && h.lng != null);
  const highlightIds = Object.keys(assistPriorities);
  const activeShelterIds = new Set(escapeRoutes.map((r) => r.destinationId));

  return (
    <MapContainer
      center={[CEBU_AREA.center.lat, CEBU_AREA.center.lng]}
      zoom={CEBU_AREA.zoom}
      className="h-full w-full [&_.leaflet-control-attribution]:text-[9px]"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle
        center={[CEBU_AREA.center.lat, CEBU_AREA.center.lng]}
        radius={450}
        pathOptions={{
          color: "#1f8f55",
          weight: 1,
          fillColor: "#1f8f55",
          fillOpacity: 0.1,
        }}
      />
      <Marker
        position={[CEBU_AREA.center.lat, CEBU_AREA.center.lng]}
        icon={hallIcon}
      >
        <Popup>
          <strong>Nangka Barangay Hall</strong>
          <br />
          {CEBU_AREA.name}
        </Popup>
      </Marker>
      {mapped.map((h) => {
        const priority = assistPriorities[h.id];
        return (
          <Marker
            key={h.id}
            position={[h.lat!, h.lng!]}
            icon={priority ? priorityHouseIcon(priority) : houseIcon}
            zIndexOffset={priority ? 800 : 0}
          >
            <Popup>
              <strong>{h.ownerName}</strong>
              {priority ? (
                <>
                  <br />
                  <span className="font-mono text-xs uppercase">
                    AI · {priority}
                  </span>
                </>
              ) : null}
              <br />
              {h.purok}
              <br />
              {h.address}
              <br />
              <span className="font-mono text-xs">{h.phone}</span>
            </Popup>
          </Marker>
        );
      })}
      {quakes.map((q) => (
        <Marker key={q.id} position={[q.lat, q.lng]} icon={quakeIcon(q.mag)}>
          <Popup>
            <strong>M{q.mag?.toFixed(1) ?? "?"} · earthquake</strong>
            <br />
            {q.place}
            <br />
            {Math.round(q.distanceKm)} km from ops area
            <br />
            {new Date(q.time).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
            })}
            {q.url ? (
              <>
                <br />
                <a href={q.url} target="_blank" rel="noreferrer">
                  USGS detail
                </a>
              </>
            ) : null}
          </Popup>
        </Marker>
      ))}
      {landslides.map((ls) => (
        <Marker
          key={ls.id}
          position={[ls.lat, ls.lng]}
          icon={landslideIcon(ls.severity)}
        >
          <Popup>
            <strong>Landslide · {landslideSeverityLabel(ls.severity)}</strong>
            <br />
            {ls.name}
            <br />
            {ls.place} ({ls.purokHint})
            <br />
            {ls.notes}
          </Popup>
        </Marker>
      ))}
      {floods.map((fl) => (
        <Marker
          key={fl.id}
          position={[fl.lat, fl.lng]}
          icon={floodIcon(fl.severity)}
        >
          <Popup>
            <strong>Flood · {floodSeverityLabel(fl.severity)}</strong>
            <br />
            {fl.name}
            <br />
            {fl.place} ({fl.purokHint})
            <br />
            Depth ~{fl.depthCm} cm
            <br />
            {fl.notes}
          </Popup>
        </Marker>
      ))}
      {typhoons.map((ty) => (
        <Marker
          key={ty.id}
          position={[ty.lat, ty.lng]}
          icon={typhoonIcon()}
        >
          <Popup>
            <strong>{ty.name}</strong>
            <br />
            {typhoonCategoryLabel(ty.category)} · {ty.maxWindsKmh} km/h
            <br />
            {ty.movement}
            <br />
            {Math.round(ty.distanceKm)} km from Nangka · {ty.etaNote}
            <br />
            {ty.notes}
          </Popup>
        </Marker>
      ))}
      {typhoons.map((ty) => (
        <Circle
          key={`${ty.id}-ring`}
          center={[ty.lat, ty.lng]}
          radius={Math.max(20000, ty.distanceKm * 400)}
          pathOptions={{
            color: "#2563eb",
            weight: 1,
            dashArray: "4 6",
            fillColor: "#3b82f6",
            fillOpacity: 0.04,
          }}
        />
      ))}
      {escapeRoutes.map((route) => {
        const path = route.path?.length >= 2 ? route.path : [route.from, route.to];
        const mid = path[Math.floor(path.length * 0.55)] ?? route.to;
        return (
          <Fragment key={`escape-${route.householdId}`}>
            <Polyline
              positions={path.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{
                color: "#167445",
                weight: route.routed ? 4 : 2,
                opacity: 0.9,
                dashArray: route.routed ? undefined : "6 8",
              }}
            />
            <Marker
              position={[mid.lat, mid.lng]}
              icon={escapeArrowIcon(route.bearing)}
              zIndexOffset={900}
            >
              <Popup>
                <strong>
                  Escape · {route.direction}
                  {route.routed ? " · via roads" : ""}
                </strong>
                <br />
                {route.instruction}
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
      {NANGKA_SAFE_POINTS.filter((sp) => activeShelterIds.has(sp.id)).map(
        (sp) => (
          <Marker
            key={sp.id}
            position={[sp.lat, sp.lng]}
            icon={shelterIcon}
            zIndexOffset={700}
          >
            <Popup>
              <strong>Safe point · {sp.name}</strong>
              <br />
              {sp.notes}
            </Popup>
          </Marker>
        ),
      )}
      <FitHouseholds
        households={households}
        highlightIds={highlightIds}
        escapeRoutes={escapeRoutes}
      />
    </MapContainer>
  );
}
