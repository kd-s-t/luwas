"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
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
import { Loader2, LocateFixed } from "lucide-react";
import type { AssistEscapeRoute, AssistPriority } from "@/lib/ai/assistTypes";
import { pointAndBearingAlongPath } from "@/lib/geo/bearing";
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
import { HouseholdPinsLayer } from "@/components/HouseholdPinsLayer";
import type { Household } from "@/lib/households/types";
import {
  lucideLandslideMarkerHtml,
  lucideTyphoonMarkerHtml,
  reportPinMarkerHtml,
} from "@/lib/map/lucideMarkerHtml";
import type { ScenarioReportPin } from "@/lib/scenarios/types";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

type MapFlyFn = (lat: number, lng: number, zoom?: number) => void;

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

/** Nav chevron — tip = forward. Bearing 0° = north (up on the map). */
function escapeChevronIcon(bearing: number) {
  const deg = Number.isFinite(bearing) ? bearing : 0;
  return L.divIcon({
    className: "dro-map-marker dro-map-escape-arrow-wrap",
    html: `<span class="dro-map-escape-chevron" style="transform:rotate(${deg}deg)" aria-hidden="true">
      <svg viewBox="0 0 32 32" width="28" height="28" focusable="false">
        <path class="dro-map-escape-chevron-halo" d="M16 3.2 L27.2 26.4 L16 20.8 L4.8 26.4 Z"/>
        <path class="dro-map-escape-chevron-body" d="M16 5.4 L25.2 25 L16 19.8 L6.8 25 Z"/>
      </svg>
    </span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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

/** Keep two-finger pinch on the map (Safari otherwise zooms the page). */
function MapTouchGuard() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    el.style.touchAction = "none";

    const blockGesture = (e: Event) => {
      e.preventDefault();
    };
    // iOS Safari legacy gesture events
    el.addEventListener("gesturestart", blockGesture, { passive: false });
    el.addEventListener("gesturechange", blockGesture, { passive: false });
    el.addEventListener("gestureend", blockGesture, { passive: false });

    return () => {
      el.removeEventListener("gesturestart", blockGesture);
      el.removeEventListener("gesturechange", blockGesture);
      el.removeEventListener("gestureend", blockGesture);
    };
  }, [map]);
  return null;
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

/** Re-fly when the locate control fires again (same coords). */
function FlyToFocus({
  target,
  nonce,
}: {
  target: { lat: number; lng: number } | null;
  nonce: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target || nonce === 0) return;
    map.flyTo([target.lat, target.lng], 16, { duration: 0.85 });
  }, [target, nonce, map]);
  return null;
}

function MapFlyBridge({ flyRef }: { flyRef: MutableRefObject<MapFlyFn | null> }) {
  const map = useMap();
  useEffect(() => {
    flyRef.current = (lat, lng, zoom = 16) => {
      map.flyTo([lat, lng], zoom, { duration: 0.85 });
    };
    return () => {
      flyRef.current = null;
    };
  }, [map, flyRef]);
  return null;
}

function LocateMeButton({
  knownLocation,
  flyRef,
  onLocated,
}: {
  knownLocation: { lat: number; lng: number } | null;
  flyRef: MutableRefObject<MapFlyFn | null>;
  onLocated: (lat: number, lng: number) => void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function locate() {
    if (!navigator.geolocation) {
      setStatus("error");
      setError("Location not supported");
      return;
    }
    if (knownLocation) {
      flyRef.current?.(knownLocation.lat, knownLocation.lng);
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        onLocated(lat, lng);
        flyRef.current?.(lat, lng);
        setStatus("idle");
      },
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Permission denied"
            : "Could not locate",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 30_000,
      },
    );
  }

  return (
    <div className="pointer-events-none absolute top-14 right-2.5 z-[1000] flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          if (status !== "locating") locate();
        }}
        title="Focus on my location"
        aria-label="Focus on my location"
        disabled={status === "locating"}
        className={cn(
          "pointer-events-auto flex size-9 items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-60",
          knownLocation && status === "idle" && "text-[var(--accent)]",
        )}
      >
        {status === "locating" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <LocateFixed className="size-4" aria-hidden />
        )}
      </button>
      {error ? (
        <p className="pointer-events-auto max-w-[9rem] border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-mono text-[9px] tracking-wide text-[var(--danger)] uppercase">
          {error}
        </p>
      ) : null}
    </div>
  );
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
  /** Called when the in-map locate control gets a fix */
  onUserLocationChange?: (loc: { lat: number; lng: number }) => void;
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
  onUserLocationChange,
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
  const flyRef = useRef<MapFlyFn | null>(null);
  const [localUser, setLocalUser] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const effectiveUser = userLocation ?? localUser;
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

  const [basemap, setBasemap] = useState<"streets" | "terrain">("terrain");

  function handleLocated(lat: number, lng: number) {
    setLocalUser({ lat, lng });
    setFocusNonce((n) => n + 1);
    onUserLocationChange?.({ lat, lng });
  }

  return (
    <div className="relative h-full w-full">
    <MapContainer
      center={[area.center.lat, area.center.lng]}
      zoom={area.zoom}
      className="h-full w-full touch-none [&_.leaflet-control-attribution]:text-[9px]"
      scrollWheelZoom={false}
      touchZoom
      bounceAtZoomLimits={false}
    >
      {basemap === "terrain" ? (
        <TileLayer
          key="terrain"
          attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://viewfinderpanoramas.org">SRTM</a> | Style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
          maxZoom={17}
        />
      ) : (
        <TileLayer
          key="streets"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      )}
      <MapTouchGuard />
      <MapFlyBridge flyRef={flyRef} />
      <RecenterOnArea
        area={area}
        userLocation={effectiveUser}
        skip={hasForecastTrack && !effectiveUser}
      />
      <FlyToFocus target={effectiveUser} nonce={focusNonce} />
      <FitTyphoonTrack
        typhoons={layerTyphoons}
        area={area}
        enabled={hasForecastTrack && !effectiveUser}
      />
      {showDemoLayers || !effectiveUser ? (
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
      ) : null}
      {effectiveUser ? (
        <Marker
          position={[effectiveUser.lat, effectiveUser.lng]}
          icon={youIcon}
          zIndexOffset={1000}
        >
          <Popup>
            <strong>You are here</strong>
            <br />
            {area.name}
          </Popup>
        </Marker>
      ) : null}
      {mapped.length > 0 ? (
        <HouseholdPinsLayer
          households={mapped}
          assistPriorities={assistPriorities}
        />
      ) : null}
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
      {layerReports.map((rp) => {
        const href = rp.href ?? (rp.mediaUrl ? `/reports/${rp.id}` : null);
        return (
          <Marker
            key={rp.id}
            position={[rp.lat, rp.lng]}
            icon={reportIcon(rp.kind)}
            zIndexOffset={860}
          >
            <Popup>
              <strong>{rp.title}</strong>
              <br />
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs uppercase underline"
                >
                  {rp.sourceLabel}
                </a>
              ) : (
                <span className="font-mono text-xs uppercase">
                  {rp.sourceLabel}
                </span>
              )}
              <br />
              {rp.purokHint}
              <br />
              {rp.notes}
            </Popup>
          </Marker>
        );
      })}
      {layerEscapes.map((route, escapeIndex) => {
        const path =
          route.path?.length >= 2 ? route.path : [route.from, route.to];
        const positions = path.map(
          (p) => [p.lat, p.lng] as [number, number],
        );
        // Chevron near shelter end, oriented to local tangent (not crow-fly bearing).
        const tip = pointAndBearingAlongPath(path, 0.78);
        const showChevron = escapeIndex < 48;
        return (
          <Fragment key={`escape-${route.householdId}`}>
            <Polyline
              positions={positions}
              pathOptions={{
                color: "#ffffff",
                weight: route.routed ? 7 : 5,
                opacity: 0.85,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              positions={positions}
              pathOptions={{
                color: "#1f8f55",
                weight: route.routed ? 3.5 : 2.5,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
                dashArray: "10 8",
                className: "dro-escape-flow",
              }}
            />
            {showChevron ? (
              <Marker
                position={[tip.point.lat, tip.point.lng]}
                icon={escapeChevronIcon(tip.bearing)}
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
            ) : null}
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
              Elevation ~{Math.round(sp.elevM)} m (Google Elevation)
              <br />
              {sp.notes}
            </Popup>
          </Marker>
        ))}
      {showDemoLayers && !effectiveUser && !hasForecastTrack ? (
        <FitHouseholds
          area={area}
          households={mapped}
          highlightIds={highlightIds}
          escapeRoutes={layerEscapes}
        />
      ) : null}
    </MapContainer>
    <LocateMeButton
      knownLocation={effectiveUser}
      flyRef={flyRef}
      onLocated={handleLocated}
    />
    <div className="absolute bottom-3 left-3 z-[1000] flex overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)]/95 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        onClick={() => setBasemap("terrain")}
        className={cn(
          "px-2.5 py-1.5 font-mono text-[9px] tracking-[0.14em] uppercase transition",
          basemap === "terrain"
            ? "bg-[var(--accent)] text-[var(--on-accent)]"
            : "text-[var(--muted)] hover:bg-[var(--surface-panel)] hover:text-[var(--foreground)]",
        )}
        aria-pressed={basemap === "terrain"}
      >
        Terrain
      </button>
      <button
        type="button"
        onClick={() => setBasemap("streets")}
        className={cn(
          "px-2.5 py-1.5 font-mono text-[9px] tracking-[0.14em] uppercase transition",
          basemap === "streets"
            ? "bg-[var(--accent)] text-[var(--on-accent)]"
            : "text-[var(--muted)] hover:bg-[var(--surface-panel)] hover:text-[var(--foreground)]",
        )}
        aria-pressed={basemap === "streets"}
      >
        Streets
      </button>
    </div>
    </div>
  );
}
