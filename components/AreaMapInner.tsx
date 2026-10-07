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
import {
  DEFAULT_MAP_AREA,
  isNangkaOpsArea,
  type MapArea,
} from "@/lib/geo/mapAreas";
import { NANGKA_SAFE_POINTS } from "@/lib/geo/safePoints";
import type { FireSample } from "@/lib/hazards/fireSamples";
import { fireSeverityLabel } from "@/lib/hazards/fireSamples";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import { floodSeverityLabel } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import { landslideSeverityLabel } from "@/lib/hazards/landslideSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";
import { typhoonCategoryLabel } from "@/lib/hazards/typhoonSamples";
import type { QuakeEvent } from "@/lib/hazards/usgsEarthquakes";
import type { Household } from "@/lib/households/types";
import {
  lucideLandslideMarkerHtml,
  lucideTyphoonMarkerHtml,
  reportPinMarkerHtml,
} from "@/lib/map/lucideMarkerHtml";
import type { ScenarioReportPin } from "@/lib/scenarios/types";
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
    html: lucideLandslideMarkerHtml(severity, 22),
    iconSize: [22, 22],
    iconAnchor: [11, 11],
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

/** Lucide Tornado — typhoon / tropical cyclone marker. */
function typhoonIcon() {
  return L.divIcon({
    className: "dro-map-marker",
    html: lucideTyphoonMarkerHtml(28),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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

const youIcon = L.divIcon({
  className: "dro-map-marker",
  html: "<span class='dro-map-marker-dot dro-map-marker-dot-you'></span>",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function fireIcon(severity: FireSample["severity"]) {
  return L.divIcon({
    className: "dro-map-marker",
    html: `<span class="dro-map-marker-fire dro-map-marker-fire-${severity}"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 10],
  });
}

function reportIcon(kind: ScenarioReportPin["kind"]) {
  return L.divIcon({
    className: "dro-map-marker",
    html: reportPinMarkerHtml(kind),
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function RecenterOnArea({
  area,
  userLocation,
  skip,
}: {
  area: MapArea;
  userLocation?: { lat: number; lng: number } | null;
  skip?: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (skip) return;
    const lat = userLocation?.lat ?? area.center.lat;
    const lng = userLocation?.lng ?? area.center.lng;
    const zoom = userLocation ? Math.max(area.zoom, 16) : area.zoom;
    map.flyTo([lat, lng], zoom, { duration: 0.85 });
  }, [
    skip,
    area.center.lat,
    area.center.lng,
    area.zoom,
    area.id,
    userLocation?.lat,
    userLocation?.lng,
    map,
  ]);
  return null;
}

function FitTyphoonTrack({
  typhoons,
  area,
  enabled,
}: {
  typhoons: TyphoonSample[];
  area: MapArea;
  enabled: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    const points: [number, number][] = [
      [area.center.lat, area.center.lng],
    ];
    const eyeNear = typhoons.some((t) => t.distanceKm < 60);
    for (const ty of typhoons) {
      points.push([ty.lat, ty.lng]);
      if (!eyeNear) {
        for (const p of ty.track ?? []) {
          points.push([p.lat, p.lng]);
        }
      }
    }
    if (points.length < 2) return;
    map.fitBounds(L.latLngBounds(points).pad(eyeNear ? 0.45 : 0.18), {
      animate: true,
      maxZoom: eyeNear ? 13 : 9,
    });
  }, [typhoons, area.center.lat, area.center.lng, enabled, map]);
  return null;
}

function FitHouseholds({
  area,
  households,
  highlightIds,
  escapeRoutes,
}: {
  area: MapArea;
  households: Household[];
  highlightIds: string[];
  escapeRoutes: AssistEscapeRoute[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!isNangkaOpsArea(area)) {
      return;
    }

    const focus =
      highlightIds.length > 0
        ? households.filter(
            (h) =>
              highlightIds.includes(h.id) && h.lat != null && h.lng != null,
          )
        : households.filter((h) => h.lat != null && h.lng != null);

    const points: [number, number][] = [
      [area.center.lat, area.center.lng],
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
      map.setView([area.center.lat, area.center.lng], area.zoom);
      return;
    }

    const bounds = L.latLngBounds(points);
    map.fitBounds(
      bounds.pad(highlightIds.length || escapeRoutes.length ? 0.55 : 0.35),
    );
  }, [area, households, highlightIds, escapeRoutes, map]);

  return null;
}

type AreaMapInnerProps = {
  area?: MapArea;
  /** Visitor GPS pin — map flies here when set */
  userLocation?: { lat: number; lng: number } | null;
  /** Keep Nangka demo / scenario layers even if the visitor is elsewhere */
  forceLayers?: boolean;
  households: Household[];
  quakes: QuakeEvent[];
  landslides: LandslideSample[];
  floods: FloodSample[];
  typhoons: TyphoonSample[];
  fires?: FireSample[];
  reportPins?: ScenarioReportPin[];
  /** householdId → AI priority — updates marker style + map focus */
  assistPriorities?: Record<string, AssistPriority>;
  escapeRoutes?: AssistEscapeRoute[];
};

export default function AreaMapInner({
  area = DEFAULT_MAP_AREA,
  userLocation = null,
  forceLayers = false,
  households,
  quakes,
  landslides,
  floods,
  typhoons,
  fires = [],
  reportPins = [],
  assistPriorities = {},
  escapeRoutes = [],
}: AreaMapInnerProps) {
  const showDemoLayers = forceLayers || isNangkaOpsArea(area);
  const mapped = showDemoLayers
    ? households.filter((h) => h.lat != null && h.lng != null)
    : [];
  const highlightIds = Object.keys(assistPriorities);
  const layerLandslides = showDemoLayers ? landslides : [];
  const layerFloods = showDemoLayers ? floods : [];
  const layerTyphoons = showDemoLayers ? typhoons : [];
  const layerFires = showDemoLayers ? fires : [];
  const layerReports = showDemoLayers ? reportPins : [];
  const layerEscapes = showDemoLayers ? escapeRoutes : [];
  const layerSafePoints = showDemoLayers ? NANGKA_SAFE_POINTS : [];
  const activeShelterIds = new Set(layerEscapes.map((r) => r.destinationId));
  const hasForecastTrack = layerTyphoons.some((t) => (t.track?.length ?? 0) > 1);

  return (
    <MapContainer
      center={[area.center.lat, area.center.lng]}
      zoom={area.zoom}
      className="h-full w-full [&_.leaflet-control-attribution]:text-[9px]"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterOnArea
        area={area}
        userLocation={userLocation}
        skip={hasForecastTrack && !userLocation}
      />
      <FitTyphoonTrack
        typhoons={layerTyphoons}
        area={area}
        enabled={hasForecastTrack && !userLocation}
      />
      {!userLocation ? (
        <Circle
          center={[area.center.lat, area.center.lng]}
          radius={450}
          pathOptions={{
            color: "#1f8f55",
            weight: 1,
            fillColor: "#1f8f55",
            fillOpacity: 0.1,
          }}
        />
      ) : null}
      {!userLocation ? (
        <Marker
          position={[area.center.lat, area.center.lng]}
          icon={hallIcon}
        >
          <Popup>
            <strong>Brgy. {area.barangay} hall</strong>
            <br />
            {area.name}
          </Popup>
        </Marker>
      ) : (
        <Marker
          position={[userLocation.lat, userLocation.lng]}
          icon={youIcon}
          zIndexOffset={1000}
        >
          <Popup>
            <strong>You are here</strong>
            <br />
            {area.name}
          </Popup>
        </Marker>
      )}
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
      {layerLandslides.map((ls) => (
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
      {layerFloods.map((fl) => (
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
      {layerTyphoons.map((ty) =>
        ty.track && ty.track.length > 1 ? (
          <Polyline
            key={`${ty.id}-track`}
            positions={ty.track.map(
              (p) => [p.lat, p.lng] as [number, number],
            )}
            pathOptions={{
              color: "#1d4ed8",
              weight: 3,
              opacity: 0.85,
              dashArray: "8 10",
            }}
          />
        ) : null,
      )}
      {layerTyphoons.map((ty) => (
        <Fragment key={`${ty.id}-eye`}>
          <Marker position={[ty.lat, ty.lng]} icon={typhoonIcon()}>
            <Popup>
              <strong>{ty.name}</strong>
              <br />
              Eye · {typhoonCategoryLabel(ty.category)} · {ty.maxWindsKmh} km/h
              <br />
              {ty.movement}
              <br />
              {Math.round(ty.distanceKm)} km from Nangka · {ty.etaNote}
              <br />
              {ty.notes}
            </Popup>
          </Marker>
          {(ty.windRadiiKm
            ? [
                {
                  key: "gale",
                  km: ty.windRadiiKm.gale,
                  color: "#93c5fd",
                  fill: 0.03,
                },
                {
                  key: "storm",
                  km: ty.windRadiiKm.storm,
                  color: "#3b82f6",
                  fill: 0.05,
                },
                {
                  key: "typhoon",
                  km: ty.windRadiiKm.typhoon,
                  color: "#1d4ed8",
                  fill: 0.08,
                },
              ]
            : [
                {
                  key: "approx",
                  km: Math.max(20, ty.distanceKm * 0.4),
                  color: "#2563eb",
                  fill: 0.04,
                },
              ]
          ).map((ring) => (
            <Circle
              key={`${ty.id}-${ring.key}`}
              center={[ty.lat, ty.lng]}
              radius={ring.km * 1000}
              pathOptions={{
                color: ring.color,
                weight: 1,
                dashArray: "4 6",
                fillColor: ring.color,
                fillOpacity: ring.fill,
              }}
            />
          ))}
        </Fragment>
      ))}
      {layerFires.map((fi) => (
        <Marker
          key={fi.id}
          position={[fi.lat, fi.lng]}
          icon={fireIcon(fi.severity)}
          zIndexOffset={850}
        >
          <Popup>
            <strong>Fire · {fireSeverityLabel(fi.severity)}</strong>
            <br />
            {fi.name}
            <br />
            {fi.place} ({fi.purokHint})
            <br />
            {fi.notes}
          </Popup>
        </Marker>
      ))}
      {layerReports.map((rp) => (
        <Marker
          key={rp.id}
          position={[rp.lat, rp.lng]}
          icon={reportIcon(rp.kind)}
          zIndexOffset={860}
        >
          <Popup>
            <strong>{rp.title}</strong>
            <br />
            <span className="font-mono text-xs uppercase">
              {rp.sourceLabel}
            </span>
            <br />
            {rp.purokHint}
            <br />
            {rp.notes}
          </Popup>
        </Marker>
      ))}
      {layerEscapes.map((route) => {
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
      {layerSafePoints
        .filter((sp) => activeShelterIds.has(sp.id))
        .map((sp) => (
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
        ))}
      {showDemoLayers && !userLocation && !hasForecastTrack ? (
        <FitHouseholds
          area={area}
          households={mapped}
          highlightIds={highlightIds}
          escapeRoutes={layerEscapes}
        />
      ) : null}
    </MapContainer>
  );
}
