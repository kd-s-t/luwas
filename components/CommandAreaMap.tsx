"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import {
  AdvancedMarkerAnchorPoint,
  APIProvider,
  Map,
  Polyline,
  useMap,
} from "@vis.gl/react-google-maps";
import { Crosshair, Loader2, LocateFixed, Tornado } from "lucide-react";
import type { AssistEscapeRoute, AssistPriority } from "@/lib/ai/assistTypes";
import { distKm } from "@/lib/geo/bearing";
import { pointInFloodFootprints } from "@/lib/geo/elevFloodFootprint";
import { DEFAULT_MAP_AREA, type MapArea } from "@/lib/geo/mapAreas";
import { estimateElevM } from "@/lib/geo/nangkaElevation";
import {
  phoneToTelHref,
  type ResponderMapPin,
} from "@/lib/geo/responderStations";
import type { SafePoint } from "@/lib/geo/safePoints";
import type { FireSample } from "@/lib/hazards/fireSamples";
import { fireSeverityLabel } from "@/lib/hazards/fireSamples";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import { floodSeverityLabel } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import { landslideSeverityLabel } from "@/lib/hazards/landslideSamples";
import {
  formatTinoTrackChip,
  TINO_CEBU_LANDFALL_ISO,
} from "@/lib/hazards/tinoIbtracs";
import type { TyphoonSample, TyphoonTrackPoint } from "@/lib/hazards/typhoonSamples";
import { typhoonCategoryLabel } from "@/lib/hazards/typhoonSamples";
import type { QuakeEvent } from "@/lib/hazards/usgsEarthquakes";
import { EvacStockList } from "@/components/EvacStockList";
import { FloodTilesLayer } from "@/components/FloodTilesLayer";
import { HouseholdPinsLayer } from "@/components/HouseholdPinsLayer";
import { MapHtmlMarker } from "@/components/MapHtmlMarker";
import { emptyEvacStock } from "@/lib/evacCenters/types";
import type { Household } from "@/lib/households/types";
import {
  googleMapsApiKey,
  googleMapsMapId,
  hasGoogleMapsApiKey,
} from "@/lib/map/googleMapsConfig";
import {
  facilityMarkerHtml,
  lucideLandslideMarkerHtml,
  lucideTyphoonMarkerHtml,
  reportPinMarkerHtml,
  type FacilityMarkerKind,
} from "@/lib/map/lucideMarkerHtml";
import {
  evacFillLabel,
  evacStatusForSafePoint,
  formatEvacPopulationLine,
} from "@/lib/reports/evacStatus";
import type {
  DrrmScenarioPhase,
  ScenarioReportPin,
} from "@/lib/scenarios/types";
import { cn } from "@/lib/utils";

/** True when flood wash tiles are painted (AI elev footprints present). */
function floodWashOn(floods: FloodSample[]): boolean {
  return floods.some(
    (f) => (f.footprints?.length ?? 0) > 0 || Boolean(f.footprint?.length),
  );
}

/**
 * True when a facility sits in / under the blue flood wash.
 * Matches FloodTilesLayer (bbox of each ring), not only point-in-polygon.
 */
function facilityInFlood(
  lat: number,
  lng: number,
  floods: FloodSample[],
): boolean {
  const pt = { lat, lng };
  const hasTiles = floodWashOn(floods);

  for (const fl of floods) {
    if (pointInFloodFootprints(pt, fl.footprints)) return true;
    if (fl.footprint && pointInFloodFootprints(pt, [fl.footprint])) return true;
    const rings = fl.footprints?.length
      ? fl.footprints
      : fl.footprint
        ? [fl.footprint]
        : [];
    for (const ring of rings) {
      if (ring.length < 3) continue;
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;
      let cLat = 0;
      let cLng = 0;
      for (const p of ring) {
        minLat = Math.min(minLat, p.lat);
        maxLat = Math.max(maxLat, p.lat);
        minLng = Math.min(minLng, p.lng);
        maxLng = Math.max(maxLng, p.lng);
        cLat += p.lat;
        cLng += p.lng;
      }
      cLat /= ring.length;
      cLng /= ring.length;
      if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
        return true;
      }
      if (distKm(pt, { lat: cLat, lng: cLng }) * 1000 <= 120) return true;
    }
    const radiusM = fl.radiusM && fl.radiusM > 0 ? fl.radiusM : 120;
    if (distKm(pt, { lat: fl.lat, lng: fl.lng }) * 1000 <= radiusM) return true;
  }

  if (hasTiles && estimateElevM(lat, lng) <= 13) return true;
  return false;
}

type MapFlyFn = (lat: number, lng: number, zoom?: number) => void;
type MapFitFn = () => void;

function typhoonFitPoints(
  area: MapArea,
  typhoons: TyphoonSample[],
): { points: google.maps.LatLngLiteral[]; eyeNear: boolean } {
  const points: google.maps.LatLngLiteral[] = [
    { lat: area.center.lat, lng: area.center.lng },
  ];
  const eyeNear = typhoons.some((t) => t.distanceKm < 60);
  for (const ty of typhoons) {
    points.push({ lat: ty.lat, lng: ty.lng });
    if (!eyeNear) {
      for (const p of ty.track ?? []) {
        points.push({ lat: p.lat, lng: p.lng });
      }
    }
  }
  return { points, eyeNear };
}

function fitBrgyAndTyphoon(
  map: google.maps.Map,
  area: MapArea,
  typhoons: TyphoonSample[],
) {
  if (typhoons.length === 0) return;
  const { points, eyeNear } = typhoonFitPoints(area, typhoons);
  if (points.length < 2) return;
  const bounds = new google.maps.LatLngBounds();
  for (const p of points) bounds.extend(p);
  map.fitBounds(bounds, eyeNear ? 80 : 40);
  const maxZoom = eyeNear ? 13 : 9;
  const listener = google.maps.event.addListenerOnce(map, "idle", () => {
    const z = map.getZoom();
    if (z != null && z > maxZoom) map.setZoom(maxZoom);
  });
  void listener;
}

function facilityHtml(
  kind: FacilityMarkerKind,
  flooded = false,
  opts?: { occupancy?: number; pulse?: boolean },
) {
  const base = facilityMarkerHtml(kind, 32, { flooded });
  const pulse = opts?.pulse !== false;
  const people =
    typeof opts?.occupancy === "number" && opts.occupancy > 0
      ? `<span class="dro-map-occupancy-badge">${opts.occupancy}</span>`
      : "";
  return `<span class="dro-map-facility-stack${pulse ? " dro-map-facility-pulse" : ""}">${base}${people}</span>`;
}

function googleDirectionsUrl(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}

function quakeHtml(mag: number | null) {
  const m = mag ?? 0;
  const size = m >= 5 ? 18 : m >= 4 ? 15 : 12;
  return `<span class="dro-map-marker-dot dro-map-marker-dot-quake" style="width:${size}px;height:${size}px"></span>`;
}

function landslideHtml(severity: LandslideSample["severity"]) {
  return lucideLandslideMarkerHtml(severity, 22);
}

function floodHtml(severity: FloodSample["severity"]) {
  return `<span class="dro-map-marker-flood dro-map-marker-flood-${severity}"></span>`;
}

function trackEtaHtml(text: string, emphasize = false) {
  return `<span class="dro-map-track-eta${emphasize ? " dro-map-track-eta-strong" : ""}">${text}</span>`;
}

function typhoonHtml() {
  return lucideTyphoonMarkerHtml(28);
}

const youHtml =
  "<span class='dro-map-marker-dot dro-map-marker-dot-you'></span>";

function fireHtml(severity: FireSample["severity"]) {
  return `<span class="dro-map-marker-fire dro-map-marker-fire-${severity}"></span>`;
}

function reportHtml(kind: ScenarioReportPin["kind"]) {
  return reportPinMarkerHtml(kind);
}

/**
 * ~12h synoptic chips + endpoints. Skips the current eye so the typhoon
 * marker stays visible; alternates above/below to reduce chip pile-ups.
 */
function trackEtaSamples(
  track: TyphoonTrackPoint[],
  eye?: { lat: number; lng: number; at?: string },
): TyphoonTrackPoint[] {
  const out: TyphoonTrackPoint[] = [];
  for (let i = 0; i < track.length; i++) {
    const p = track[i]!;
    if (!p.at) continue;
    const hour = new Date(p.at).getUTCHours();
    const keep =
      i === 0 ||
      i === track.length - 1 ||
      hour === 0 ||
      hour === 12;
    if (!keep) continue;
    if (out.length && out[out.length - 1]!.at === p.at) continue;
    if (eye) {
      if (eye.at && p.at === eye.at) continue;
      const dLat = Math.abs(p.lat - eye.lat);
      const dLng = Math.abs(p.lng - eye.lng);
      if (dLat < 0.15 && dLng < 0.25) continue;
    }
    out.push(p);
  }
  return out;
}

function RecenterOnArea({
  area,
  userLocation,
  skip,
  lockToArea,
}: {
  area: MapArea;
  userLocation?: { lat: number; lng: number } | null;
  skip?: boolean;
  lockToArea?: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || skip) return;
    const followUser = Boolean(userLocation) && !lockToArea;
    const lat = followUser ? userLocation!.lat : area.center.lat;
    const lng = followUser ? userLocation!.lng : area.center.lng;
    const zoom = followUser ? Math.max(area.zoom, 16) : area.zoom;
    map.panTo({ lat, lng });
    map.setZoom(zoom);
    // Intentionally key off lat/lng fields — parent may pass a new object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- userLocation object identity
  }, [
    skip,
    lockToArea,
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

function FlyToFocus({
  target,
  nonce,
}: {
  target: { lat: number; lng: number } | null;
  nonce: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || !target || nonce === 0) return;
    map.panTo({ lat: target.lat, lng: target.lng });
    map.setZoom(16);
  }, [target, nonce, map]);
  return null;
}

function MapFlyBridge({
  flyRef,
  fitTyphoonRef,
  area,
  typhoons,
}: {
  flyRef: MutableRefObject<MapFlyFn | null>;
  fitTyphoonRef: MutableRefObject<MapFitFn | null>;
  area: MapArea;
  typhoons: TyphoonSample[];
}) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    flyRef.current = (lat, lng, zoom = 16) => {
      map.panTo({ lat, lng });
      map.setZoom(zoom);
    };
    fitTyphoonRef.current = () => fitBrgyAndTyphoon(map, area, typhoons);
    return () => {
      flyRef.current = null;
      fitTyphoonRef.current = null;
    };
  }, [map, flyRef, fitTyphoonRef, area, typhoons]);
  return null;
}

function ZoomToBarangayButton({
  area,
  flyRef,
}: {
  area: MapArea;
  flyRef: MutableRefObject<MapFlyFn | null>;
}) {
  const label = `Zoom to Brgy. ${area.barangay}`;
  return (
    <button
      type="button"
      onClick={() => {
        flyRef.current?.(area.center.lat, area.center.lng, area.zoom);
      }}
      title={label}
      aria-label={label}
      className="pointer-events-auto flex size-9 items-center justify-center border border-[var(--border)] bg-[var(--surface)] text-[var(--accent)] shadow-sm transition hover:border-[var(--accent)]"
    >
      <Crosshair className="size-4" aria-hidden />
    </button>
  );
}

function ShowBrgyAndTyphoonButton({
  fitTyphoonRef,
  hasTyphoon,
}: {
  fitTyphoonRef: MutableRefObject<MapFitFn | null>;
  hasTyphoon: boolean;
}) {
  const label = hasTyphoon
    ? "Show barangay and typhoon"
    : "No typhoon on this map";
  return (
    <button
      type="button"
      onClick={() => {
        if (hasTyphoon) fitTyphoonRef.current?.();
      }}
      disabled={!hasTyphoon}
      title={label}
      aria-label={label}
      className={cn(
        "pointer-events-auto flex size-9 items-center justify-center border border-[var(--border)] bg-[var(--surface)] shadow-sm transition",
        hasTyphoon
          ? "text-[#1d4ed8] hover:border-[#1d4ed8]"
          : "cursor-not-allowed text-[var(--muted)] opacity-45",
      )}
    >
      <Tornado className="size-4" aria-hidden />
    </button>
  );
}

function LocateMeButton({
  knownLocation,
  flyRef,
  onLocated,
  pinOnly,
  area,
}: {
  knownLocation: { lat: number; lng: number } | null;
  flyRef: MutableRefObject<MapFlyFn | null>;
  onLocated: (lat: number, lng: number) => void;
  pinOnly?: boolean;
  area?: MapArea;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function locate() {
    if (!navigator.geolocation) {
      setStatus("error");
      setError("Location not supported");
      return;
    }
    if (knownLocation && !pinOnly) {
      flyRef.current?.(knownLocation.lat, knownLocation.lng);
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        onLocated(lat, lng);
        if (!pinOnly) flyRef.current?.(lat, lng);
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

  const locateLabel = pinOnly
    ? "Show my location pin"
    : "Focus on my location";

  return (
    <>
      {area ? <ZoomToBarangayButton area={area} flyRef={flyRef} /> : null}
      <button
        type="button"
        onClick={() => {
          if (status !== "locating") locate();
        }}
        title={locateLabel}
        aria-label={locateLabel}
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
    </>
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
    if (!map || !enabled) return;
    fitBrgyAndTyphoon(map, area, typhoons);
  }, [typhoons, area, enabled, map]);
  return null;
}

function fitMapToSafePoints(
  map: google.maps.Map,
  points: SafePoint[],
  padding = 56,
) {
  if (points.length === 0) return false;
  if (points.length === 1) {
    map.setCenter({ lat: points[0].lat, lng: points[0].lng });
    map.setZoom(16);
    return true;
  }
  const bounds = new google.maps.LatLngBounds();
  for (const p of points) bounds.extend({ lat: p.lat, lng: p.lng });
  map.fitBounds(bounds, padding);
  return true;
}

function FitHouseholds({
  area,
  households,
  safePoints = [],
  safePointsKey = "",
  highlightKey,
  escapeKey,
  escapeRoutes,
}: {
  area: MapArea;
  households: Household[];
  safePoints?: SafePoint[];
  safePointsKey?: string;
  highlightKey: string;
  escapeKey: string;
  escapeRoutes: AssistEscapeRoute[];
}) {
  const map = useMap();
  const didFitEmptyRef = useRef(false);
  const lastAreaIdRef = useRef(area.id);
  const lastSafeKeyRef = useRef(safePointsKey);
  const householdsRef = useRef(households);
  const safePointsRef = useRef(safePoints);
  const escapeRoutesRef = useRef(escapeRoutes);
  householdsRef.current = households;
  safePointsRef.current = safePoints;
  escapeRoutesRef.current = escapeRoutes;

  useEffect(() => {
    if (!map) return;
    if (lastAreaIdRef.current !== area.id) {
      lastAreaIdRef.current = area.id;
      didFitEmptyRef.current = false;
    }
    if (lastSafeKeyRef.current !== safePointsKey) {
      lastSafeKeyRef.current = safePointsKey;
      didFitEmptyRef.current = false;
    }

    const rows = householdsRef.current;
    const routes = escapeRoutesRef.current;
    const points = safePointsRef.current;
    const highlightIds = highlightKey ? highlightKey.split("|") : [];
    const hasTriage = highlightIds.length > 0 || routes.length > 0;

    if (!hasTriage) {
      if (didFitEmptyRef.current) return;
      didFitEmptyRef.current = true;
      const mapped = rows.filter((h) => h.lat != null && h.lng != null);
      if (mapped.length === 0) {
        if (fitMapToSafePoints(map, points)) return;
        map.setCenter({ lat: area.center.lat, lng: area.center.lng });
        map.setZoom(area.zoom);
        return;
      }
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: area.center.lat, lng: area.center.lng });
      for (const h of mapped) bounds.extend({ lat: h.lat!, lng: h.lng! });
      map.fitBounds(bounds, 60);
      return;
    }

    didFitEmptyRef.current = false;
    const idSet = new Set(highlightIds);
    const focus = rows.filter(
      (h) => idSet.has(h.id) && h.lat != null && h.lng != null,
    );

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: area.center.lat, lng: area.center.lng });
    const focusCap = focus.slice(0, 200);
    for (const h of focusCap) {
      bounds.extend({ lat: h.lat!, lng: h.lng! });
    }
    for (const r of routes) {
      bounds.extend({ lat: r.from.lat, lng: r.from.lng });
      bounds.extend({ lat: r.to.lat, lng: r.to.lng });
    }

    if (focusCap.length === 0 && routes.length === 0) {
      if (fitMapToSafePoints(map, points)) return;
      map.setCenter({ lat: area.center.lat, lng: area.center.lng });
      map.setZoom(area.zoom);
      return;
    }

    map.fitBounds(bounds, 90);
  }, [area, highlightKey, escapeKey, safePointsKey, map]);

  return null;
}

function MissingMapsKey() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center bg-[var(--surface)] px-4 text-center font-mono text-xs text-[var(--muted)]">
      Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for Google Maps
    </div>
  );
}

type CommandAreaMapProps = {
  area?: MapArea;
  userLocation?: { lat: number; lng: number } | null;
  onUserLocationChange?: (loc: { lat: number; lng: number }) => void;
  lockCameraToArea?: boolean;
  forceLayers?: boolean;
  households: Household[];
  quakes: QuakeEvent[];
  landslides: LandslideSample[];
  floods: FloodSample[];
  typhoons: TyphoonSample[];
  fires?: FireSample[];
  reportPins?: ScenarioReportPin[];
  safePoints?: SafePoint[];
  responders?: ResponderMapPin[];
  assistPriorities?: Record<string, AssistPriority>;
  escapeRoutes?: AssistEscapeRoute[];
  scenarioPhase?: DrrmScenarioPhase;
  scrollWheelZoom?: boolean;
};

function CommandAreaMapInner({
  area = DEFAULT_MAP_AREA,
  userLocation = null,
  onUserLocationChange,
  lockCameraToArea = false,
  forceLayers: _forceLayers = false,
  households,
  quakes,
  landslides,
  floods,
  typhoons,
  fires = [],
  reportPins = [],
  safePoints = [],
  responders = [],
  assistPriorities = {},
  escapeRoutes = [],
  scenarioPhase,
  scrollWheelZoom = true,
}: CommandAreaMapProps) {
  void _forceLayers;
  const flyRef = useRef<MapFlyFn | null>(null);
  const fitTyphoonRef = useRef<MapFitFn | null>(null);
  const [localUser, setLocalUser] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const effectiveUser = userLocation ?? localUser;
  const showUserPin = Boolean(effectiveUser) && !lockCameraToArea;
  const mapped = useMemo(
    () => households.filter((h) => h.lat != null && h.lng != null),
    [households],
  );
  const highlightKey = useMemo(() => {
    const ids = Object.keys(assistPriorities);
    if (ids.length === 0) return "";
    return ids.slice().sort().join("|");
  }, [assistPriorities]);
  const escapeKey = useMemo(
    () =>
      escapeRoutes
        .map(
          (r) =>
            `${r.destinationId}:${r.path?.length ?? 0}:${r.from.lat.toFixed(4)},${r.from.lng.toFixed(4)}`,
        )
        .join("|"),
    [escapeRoutes],
  );
  const safePointsKey = useMemo(
    () =>
      safePoints
        .map((p) => `${p.id}:${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
        .join("|"),
    [safePoints],
  );
  const fitSafePointsOnly =
    lockCameraToArea && mapped.length === 0 && safePoints.length > 0;
  const layerLandslides = landslides;
  const layerFloods = floods;
  const layerTyphoons = typhoons;
  const layerFires = fires;
  const layerReports = reportPins;
  const layerEscapes = escapeRoutes;
  const layerSafePoints = safePoints;
  const layerResponders = responders;
  const activeEvacIds = new Set(layerEscapes.map((r) => r.destinationId));
  const hasTyphoon = layerTyphoons.length > 0;
  const hasForecastTrack = layerTyphoons.some((t) => (t.track?.length ?? 0) > 1);
  const cameraFollowsUser = showUserPin;

  function handleLocated(lat: number, lng: number) {
    if (lockCameraToArea) return;
    setLocalUser({ lat, lng });
    setFocusNonce((n) => n + 1);
    onUserLocationChange?.({ lat, lng });
  }

  const mapChrome = (
    <>
      <MapFlyBridge
        flyRef={flyRef}
        fitTyphoonRef={fitTyphoonRef}
        area={area}
        typhoons={layerTyphoons}
      />
      <RecenterOnArea
        area={area}
        userLocation={showUserPin ? effectiveUser : null}
        lockToArea={lockCameraToArea}
        skip={
          fitSafePointsOnly ||
          (hasForecastTrack && !cameraFollowsUser && !lockCameraToArea)
        }
      />
      <FlyToFocus
        target={cameraFollowsUser ? effectiveUser : null}
        nonce={focusNonce}
      />
      <FitTyphoonTrack
        typhoons={layerTyphoons}
        area={area}
        enabled={
          hasForecastTrack && !cameraFollowsUser && !lockCameraToArea
        }
      />
      {layerSafePoints.every((sp) => sp.kind !== "hall") && !showUserPin ? (
        <MapHtmlMarker
          position={{ lat: area.center.lat, lng: area.center.lng }}
          html={facilityHtml("hall", false, { pulse: true })}
          zIndex={750}
        >
          <strong>Command center · Brgy. {area.barangay} Hall</strong>
          <br />
          {area.name}
        </MapHtmlMarker>
      ) : null}
      {layerEscapes.map((route) => {
        const path =
          route.path.length >= 2 ? route.path : [route.from, route.to];
        const alongRoads = route.routed && route.path.length > 2;
        return (
          <Polyline
            key={`dir-${route.householdId}-${route.destinationId}-${alongRoads ? "road" : "fly"}`}
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
      {showUserPin && effectiveUser ? (
        <MapHtmlMarker
          position={{ lat: effectiveUser.lat, lng: effectiveUser.lng }}
          html={youHtml}
          zIndex={1000}
        >
          <strong>You are here</strong>
          <br />
          {area.name}
        </MapHtmlMarker>
      ) : null}
      {mapped.length > 0 ? (
        <HouseholdPinsLayer
          households={mapped}
          assistPriorities={assistPriorities}
        />
      ) : null}
      {quakes.map((q) => (
        <MapHtmlMarker
          key={q.id}
          position={{ lat: q.lat, lng: q.lng }}
          html={quakeHtml(q.mag)}
        >
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
        </MapHtmlMarker>
      ))}
      {layerLandslides.map((ls) => (
        <MapHtmlMarker
          key={ls.id}
          position={{ lat: ls.lat, lng: ls.lng }}
          html={landslideHtml(ls.severity)}
        >
          <strong>Landslide · {landslideSeverityLabel(ls.severity)}</strong>
          <br />
          {ls.name}
          <br />
          {ls.place} ({ls.purokHint})
          <br />
          {ls.notes}
          {ls.mediaUrl ? (
            <>
              <br />
              <span className="font-mono text-xs uppercase">
                Image report · live
              </span>
              <br />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ls.mediaUrl}
                alt=""
                style={{
                  marginTop: 6,
                  maxWidth: 180,
                  width: "100%",
                  height: "auto",
                  display: "block",
                  border: "1px solid #dbe0e6",
                }}
              />
            </>
          ) : null}
        </MapHtmlMarker>
      ))}
      <FloodTilesLayer floods={layerFloods} />
      {layerFloods
        .filter((fl) => !(fl.footprints?.length || fl.footprint?.length))
        .map((fl) => (
          <MapHtmlMarker
            key={fl.id}
            position={{ lat: fl.lat, lng: fl.lng }}
            html={floodHtml(fl.severity)}
            zIndex={650}
          >
            <strong>Flood · {floodSeverityLabel(fl.severity)}</strong>
            <br />
            {fl.name}
            <br />
            {fl.place} ({fl.purokHint})
            <br />
            Depth ~{fl.depthCm} cm
            <br />
            {fl.notes}
          </MapHtmlMarker>
        ))}
      {layerTyphoons.map((ty) =>
        ty.track && ty.track.length > 1 ? (
          <Fragment key={`${ty.id}-track`}>
            <Polyline
              path={ty.track.map((p) => ({ lat: p.lat, lng: p.lng }))}
              strokeColor="#1d4ed8"
              strokeWeight={3}
              strokeOpacity={0}
              icons={[
                {
                  icon: {
                    path: "M 0,-1 0,1",
                    strokeOpacity: 0.85,
                    strokeColor: "#1d4ed8",
                    scale: 3,
                  },
                  offset: "0",
                  repeat: "18px",
                },
              ]}
            />
            {trackEtaSamples(ty.track, {
              lat: ty.lat,
              lng: ty.lng,
              at: ty.reportedAt,
            }).map((p, i) => (
              <MapHtmlMarker
                key={`${ty.id}-eta-${p.at}`}
                position={{ lat: p.lat, lng: p.lng }}
                html={trackEtaHtml(
                  formatTinoTrackChip(p.at!),
                  p.at === TINO_CEBU_LANDFALL_ISO ||
                    (p.at != null &&
                      Math.abs(
                        new Date(p.at).getTime() -
                          new Date(TINO_CEBU_LANDFALL_ISO).getTime(),
                      ) <
                        4 * 3_600_000),
                )}
                zIndex={720}
                anchorPoint={
                  i % 2 === 0
                    ? AdvancedMarkerAnchorPoint.BOTTOM_CENTER
                    : AdvancedMarkerAnchorPoint.TOP_CENTER
                }
              >
                <strong>Track · {formatTinoTrackChip(p.at!)} PHT</strong>
                <br />
                {p.label ?? ty.name}
                <br />
                Cebu landfall ETA ·{" "}
                {formatTinoTrackChip(TINO_CEBU_LANDFALL_ISO)} PHT
              </MapHtmlMarker>
            ))}
          </Fragment>
        ) : null,
      )}
      {layerTyphoons.map((ty) => (
        <MapHtmlMarker
          key={`${ty.id}-eye`}
          position={{ lat: ty.lat, lng: ty.lng }}
          html={typhoonHtml()}
          zIndex={960}
        >
          <strong>{ty.name}</strong>
          <br />
          Eye · {typhoonCategoryLabel(ty.category)} · {ty.maxWindsKmh} km/h
          <br />
          {ty.movement}
          <br />
          {Math.round(ty.distanceKm)} km from Nangka
          <br />
          <strong>{ty.etaNote}</strong>
          <br />
          {ty.notes}
        </MapHtmlMarker>
      ))}
      {layerFires.map((fi) => (
        <MapHtmlMarker
          key={fi.id}
          position={{ lat: fi.lat, lng: fi.lng }}
          html={fireHtml(fi.severity)}
          zIndex={850}
        >
          <strong>Fire · {fireSeverityLabel(fi.severity)}</strong>
          <br />
          {fi.name}
          <br />
          {fi.place} ({fi.purokHint})
          <br />
          {fi.notes}
        </MapHtmlMarker>
      ))}
      {layerReports.map((rp) => {
        const href = rp.href ?? (rp.mediaUrl ? `/reports/${rp.id}` : null);
        return (
          <MapHtmlMarker
            key={rp.id}
            position={{ lat: rp.lat, lng: rp.lng }}
            html={reportHtml(rp.kind)}
            zIndex={860}
          >
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
            {rp.kind === "evac_status" &&
            typeof rp.occupancy === "number" &&
            typeof rp.capacity === "number" ? (
              <>
                <strong>
                  {rp.occupancy} / {rp.capacity} people
                </strong>
                <br />
              </>
            ) : null}
            {rp.purokHint}
            <br />
            {rp.notes}
            {rp.mediaUrl ? (
              <>
                <br />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={rp.mediaUrl}
                  alt=""
                  style={{
                    marginTop: 6,
                    maxWidth: 180,
                    width: "100%",
                    height: "auto",
                    display: "block",
                    border: "1px solid #dbe0e6",
                  }}
                />
              </>
            ) : null}
          </MapHtmlMarker>
        );
      })}
      {layerSafePoints.map((sp) => {
        const active = activeEvacIds.has(sp.id);
        const pop = evacStatusForSafePoint(sp, layerReports);
        const isShelter =
          sp.isEvacCenter ||
          sp.kind === "evac_center" ||
          (sp.kind === "school" && sp.isEvacCenter);
        const washOn = floodWashOn(layerFloods);
        const inFlood = facilityInFlood(sp.lat, sp.lng, layerFloods);
        // Tino flood warning only in Before/During drill — not No storm
        // (EE baseline flood samples must not mark every EC as flooded).
        const tinoFloodPhase =
          scenarioPhase === "before" || scenarioPhase === "during";
        const markedUnusable =
          sp.condition === "flooded" ||
          sp.condition === "collapsed" ||
          sp.condition === "unusable";
        const floodedPin =
          Boolean(isShelter) &&
          (markedUnusable ||
            (tinoFloodPhase &&
              (scenarioPhase === "during" || washOn || inFlood)));
        const iconKind: FacilityMarkerKind =
          floodedPin && isShelter ? "evac_center" : sp.kind;
        const z =
          sp.kind === "hall"
            ? 760
            : active
              ? 740
              : sp.kind === "evac_center"
                ? 720
                : sp.kind === "school"
                  ? 710
                  : 690;
        const hallOrigin =
          layerSafePoints.find((p) => p.kind === "hall") ?? {
            lat: area.center.lat,
            lng: area.center.lng,
          };
        const dirHref =
          isShelter || sp.kind === "hall"
            ? googleDirectionsUrl(
                sp.kind === "hall"
                  ? { lat: sp.lat, lng: sp.lng }
                  : hallOrigin,
                { lat: sp.lat, lng: sp.lng },
              )
            : null;
        return (
          <MapHtmlMarker
            key={`${sp.id}-ecv5-${floodedPin ? "flood" : "dry"}-${iconKind}-${sp.occupancy ?? 0}`}
            position={{ lat: sp.lat, lng: sp.lng }}
            html={facilityHtml(iconKind, floodedPin, {
              occupancy: isShelter ? sp.occupancy : undefined,
              pulse: true,
            })}
            zIndex={z}
          >
            <strong>{sp.name}</strong>
            {sp.kind === "hall" ? (
              <>
                <br />
                <span style={{ opacity: 0.8 }}>
                  Command center · Brgy. {area.barangay} Hall
                </span>
              </>
            ) : null}
            {sp.locationLabel ? (
              <>
                <br />
                <span style={{ opacity: 0.8, fontSize: 12 }}>
                  {sp.locationLabel}
                </span>
              </>
            ) : null}
            {isShelter &&
            (sp.stock ||
              typeof sp.occupancy === "number") ? (
              <div style={{ marginTop: 8 }}>
                <EvacStockList
                  stock={sp.stock ?? emptyEvacStock()}
                  occupancy={sp.occupancy}
                  capacity={sp.capacity}
                />
              </div>
            ) : null}
            {sp.updatedAt ? (
              <>
                <br />
                <span style={{ opacity: 0.75, fontSize: 12 }}>
                  Last updated{" "}
                  {new Date(sp.updatedAt).toLocaleString("en-PH", {
                    timeZone: "Asia/Manila",
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </>
            ) : null}
            {markedUnusable ? (
              <>
                <br />
                <span style={{ fontWeight: 700, color: "#b91c1c" }}>
                  Unusable
                  {sp.condition === "flooded"
                    ? " · flooded"
                    : sp.condition === "collapsed"
                      ? " · collapsed"
                      : ""}
                </span>
                <br />
                <span style={{ color: "#9a3412", opacity: 0.95 }}>
                  Do not send evacuees here · use an alternate center
                </span>
              </>
            ) : floodedPin ? (
              <>
                <br />
                <span style={{ fontWeight: 700, color: "#b45309" }}>
                  Warning · this area is flooded
                </span>
                <br />
                <span style={{ color: "#9a3412", opacity: 0.95 }}>
                  During Tino · approaches may be impassable · redirect to dry
                  high ground / alternate EC
                </span>
              </>
            ) : pop ? (
              <>
                <br />
                <span style={{ fontWeight: 700 }}>
                  {formatEvacPopulationLine(pop)}
                </span>
                <br />
                {pop.notes}
                <br />
                <span style={{ opacity: 0.75 }}>
                  {pop.sourceLabel} · {evacFillLabel(pop.fill)}
                  {pop.href ? (
                    <>
                      {" · "}
                      <a href={pop.href}>Field report</a>
                    </>
                  ) : null}
                </span>
              </>
            ) : null}
            {dirHref && sp.kind !== "hall" ? (
              <>
                <br />
                <a
                  href={dirHref}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontWeight: 600 }}
                >
                  Directions from Brgy. Hall
                </a>
              </>
            ) : null}
          </MapHtmlMarker>
        );
      })}
      {layerResponders.map((r) => {
        const role = r.kind === "bfp" ? "Fire station (BFP)" : "Hospital";
        const markerKey =
          r.kind === "bfp" ? `${r.id}-helmet-v5` : `${r.id}-v1`;
        return (
          <MapHtmlMarker
            key={markerKey}
            position={{ lat: r.lat, lng: r.lng }}
            html={facilityHtml(r.kind)}
            zIndex={r.kind === "bfp" ? 730 : 725}
          >
            <strong>
              {role} · {r.name}
            </strong>
            <br />
            {r.seat}
            {r.covers ? (
              <>
                <br />
                Covers: {r.covers}
              </>
            ) : null}
            {r.notes ? (
              <>
                <br />
                {r.notes}
              </>
            ) : null}
            <br />
            Call:{" "}
            {r.phones.map((p, i) => (
              <span key={p}>
                {i > 0 ? " · " : null}
                <a href={phoneToTelHref(p)}>{p}</a>
              </span>
            ))}
          </MapHtmlMarker>
        );
      })}
      {!cameraFollowsUser && (!hasForecastTrack || lockCameraToArea) ? (
        <FitHouseholds
          area={area}
          households={mapped}
          safePoints={layerSafePoints}
          safePointsKey={safePointsKey}
          highlightKey={highlightKey}
          escapeKey={escapeKey}
          escapeRoutes={layerEscapes}
        />
      ) : null}
    </>
  );

  return (
    <div
      className={`relative z-0 isolate h-full w-full overscroll-none ${
        scrollWheelZoom ? "touch-none" : ""
      }`}
    >
      <Map
        className={`dro-gmap-root h-full w-full ${scrollWheelZoom ? "touch-none" : ""}`}
        defaultCenter={{ lat: area.center.lat, lng: area.center.lng }}
        defaultZoom={area.zoom}
        mapId={googleMapsMapId()}
        gestureHandling={scrollWheelZoom ? "greedy" : "cooperative"}
        disableDefaultUI={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        clickableIcons={false}
        style={{ width: "100%", height: "100%" }}
      >
        {mapChrome}
      </Map>
      {lockCameraToArea ? (
        <div className="pointer-events-none absolute top-14 right-2.5 z-[1000] flex flex-col items-end gap-1">
          <ShowBrgyAndTyphoonButton
            fitTyphoonRef={fitTyphoonRef}
            hasTyphoon={hasTyphoon}
          />
          <ZoomToBarangayButton area={area} flyRef={flyRef} />
        </div>
      ) : (
        <div className="pointer-events-none absolute top-14 right-2.5 z-[1000] flex flex-col items-end gap-1">
          <ShowBrgyAndTyphoonButton
            fitTyphoonRef={fitTyphoonRef}
            hasTyphoon={hasTyphoon}
          />
          <LocateMeButton
            knownLocation={effectiveUser}
            flyRef={flyRef}
            onLocated={handleLocated}
            area={undefined}
          />
        </div>
      )}
    </div>
  );
}

export default function CommandAreaMap(props: CommandAreaMapProps) {
  if (!hasGoogleMapsApiKey()) {
    return <MissingMapsKey />;
  }

  return (
    <APIProvider apiKey={googleMapsApiKey()} libraries={["marker"]}>
      <CommandAreaMapInner {...props} />
    </APIProvider>
  );
}
