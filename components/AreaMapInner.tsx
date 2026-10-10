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
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { Crosshair, Loader2, LocateFixed, Tornado } from "lucide-react";
import type { AssistEscapeRoute, AssistPriority } from "@/lib/ai/assistTypes";
import { pointAndBearingAlongPath } from "@/lib/geo/bearing";
import { DEFAULT_MAP_AREA, type MapArea } from "@/lib/geo/mapAreas";
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
  formatOdetteTrackChip,
  ODETTE_CEBU_LANDFALL_ISO,
} from "@/lib/hazards/odetteIbtracs";
import type { TyphoonSample, TyphoonTrackPoint } from "@/lib/hazards/typhoonSamples";
import { typhoonCategoryLabel } from "@/lib/hazards/typhoonSamples";
import type { QuakeEvent } from "@/lib/hazards/usgsEarthquakes";
import { HouseholdPinsLayer } from "@/components/HouseholdPinsLayer";
import type { Household } from "@/lib/households/types";
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
import type { ScenarioReportPin } from "@/lib/scenarios/types";
import { cn } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

type MapFlyFn = (lat: number, lng: number, zoom?: number) => void;
type MapFitFn = () => void;

function typhoonFitPoints(
  area: MapArea,
  typhoons: TyphoonSample[],
): { points: [number, number][]; eyeNear: boolean } {
  const points: [number, number][] = [[area.center.lat, area.center.lng]];
  const eyeNear = typhoons.some((t) => t.distanceKm < 60);
  for (const ty of typhoons) {
    points.push([ty.lat, ty.lng]);
    if (!eyeNear) {
      for (const p of ty.track ?? []) {
        points.push([p.lat, p.lng]);
      }
    }
  }
  return { points, eyeNear };
}

function fitBrgyAndTyphoon(
  map: L.Map,
  area: MapArea,
  typhoons: TyphoonSample[],
) {
  if (typhoons.length === 0) return;
  const { points, eyeNear } = typhoonFitPoints(area, typhoons);
  if (points.length < 2) return;
  map.fitBounds(L.latLngBounds(points).pad(eyeNear ? 0.45 : 0.18), {
    animate: true,
    maxZoom: eyeNear ? 13 : 9,
  });
}

function facilityIcon(kind: FacilityMarkerKind) {
  return L.divIcon({
    className: "dro-map-marker",
    html: facilityMarkerHtml(kind, 28),
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const hallIcon = facilityIcon("hall");

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

/** Chip sits above (or below) the track point so it never covers the eye. */
function trackEtaIcon(
  text: string,
  emphasize = false,
  side: "above" | "below" = "above",
) {
  const w = 92;
  const h = 22;
  // Anchor at the track point → label floats clear of the icon / line.
  const iconAnchor: [number, number] =
    side === "above" ? [w / 2, h + 10] : [w / 2, -10];
  return L.divIcon({
    className: "dro-map-marker dro-map-track-eta-wrap",
    html: `<span class="dro-map-track-eta${emphasize ? " dro-map-track-eta-strong" : ""}">${text}</span>`,
    iconSize: [w, h],
    iconAnchor,
  });
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
    // Never place a time chip on the live eye position.
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

/**
 * Keep trackpad / touch gestures on the map — otherwise Chrome/Safari
 * pinch-zoom or two-finger-scroll the page instead of Leaflet.
 */
function MapTouchGuard() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    el.style.touchAction = "none";
    el.style.setProperty("-ms-touch-action", "none");

    const block = (e: Event) => {
      e.preventDefault();
    };

    // Trackpad pinch = ctrl+wheel (Chrome/Edge/Firefox); Safari uses gesture*.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Leaflet scrollWheelZoom handles zoom; we only steal the event from the page.
    };

    // Multi-touch pan/pinch on tablets / phones
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("gesturestart", block, { passive: false });
    el.addEventListener("gesturechange", block, { passive: false });
    el.addEventListener("gestureend", block, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("gesturestart", block);
      el.removeEventListener("gesturechange", block);
      el.removeEventListener("gestureend", block);
    };
  }, [map]);
  return null;
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
  /** Officer ops: always frame the barangay, never GPS. */
  lockToArea?: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (skip) return;
    const followUser = Boolean(userLocation) && !lockToArea;
    const lat = followUser ? userLocation!.lat : area.center.lat;
    const lng = followUser ? userLocation!.lng : area.center.lng;
    const zoom = followUser ? Math.max(area.zoom, 16) : area.zoom;
    map.flyTo([lat, lng], zoom, { duration: 0.85 });
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
    flyRef.current = (lat, lng, zoom = 16) => {
      map.flyTo([lat, lng], zoom, { duration: 0.85 });
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
  /** Drop a pin without flying the camera (command / officer ops). */
  pinOnly?: boolean;
  /** When set, show a “zoom to my barangay” control above locate. */
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
    if (!enabled) return;
    fitBrgyAndTyphoon(map, area, typhoons);
  }, [typhoons, area, enabled, map]);
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
    const focus =
      highlightIds.length > 0
        ? households.filter(
            (h) =>
              highlightIds.includes(h.id) && h.lat != null && h.lng != null,
          )
        : households.filter((h) => h.lat != null && h.lng != null);

    // Empty brgy packs: just center the map, don't fit empty bounds.
    if (focus.length === 0 && escapeRoutes.length === 0) {
      map.setView([area.center.lat, area.center.lng], area.zoom);
      return;
    }

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
  /** Visitor GPS pin — map flies here when set (unless lockCameraToArea) */
  userLocation?: { lat: number; lng: number } | null;
  /** Called when the in-map locate control gets a fix */
  onUserLocationChange?: (loc: { lat: number; lng: number }) => void;
  /**
   * Officer command: keep the camera on the barangay ops area even if the
   * officer’s device GPS is elsewhere (e.g. working from IT Park).
   */
  lockCameraToArea?: boolean;
  /**
   * @deprecated Parent should pass only this barangay’s pack layers.
   * Kept for call-site compatibility; ignored.
   */
  forceLayers?: boolean;
  households: Household[];
  quakes: QuakeEvent[];
  landslides: LandslideSample[];
  floods: FloodSample[];
  typhoons: TyphoonSample[];
  fires?: FireSample[];
  reportPins?: ScenarioReportPin[];
  /** Safe / EC pins for this barangay pack (not global Nangka). */
  safePoints?: SafePoint[];
  /** BFP + hospitals (own LGU + nearby) with phone numbers. */
  responders?: ResponderMapPin[];
  /** householdId → AI priority — updates marker style + map focus */
  assistPriorities?: Record<string, AssistPriority>;
  escapeRoutes?: AssistEscapeRoute[];
};

export default function AreaMapInner({
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
}: AreaMapInnerProps) {
  void _forceLayers;
  const flyRef = useRef<MapFlyFn | null>(null);
  const fitTyphoonRef = useRef<MapFitFn | null>(null);
  const [localUser, setLocalUser] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const effectiveUser = userLocation ?? localUser;
  // Command ops: never show officer GPS — camera + pins stay on selected brgy.
  const showUserPin = Boolean(effectiveUser) && !lockCameraToArea;
  // Parent scopes layers per barangay pack — paint whatever is passed.
  const mapped = households.filter((h) => h.lat != null && h.lng != null);
  const highlightIds = Object.keys(assistPriorities);
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
  /** GPS may drop a pin, but camera framing stays on the barangay. */
  const cameraFollowsUser = showUserPin;

  function handleLocated(lat: number, lng: number) {
    if (lockCameraToArea) return;
    setLocalUser({ lat, lng });
    setFocusNonce((n) => n + 1);
    onUserLocationChange?.({ lat, lng });
  }

  return (
    <div className="relative h-full w-full touch-none overscroll-none">
    <MapContainer
      center={[area.center.lat, area.center.lng]}
      zoom={area.zoom}
      className="h-full w-full touch-none [&_.leaflet-control-attribution]:text-[9px]"
      scrollWheelZoom
      touchZoom
      bounceAtZoomLimits={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapTouchGuard />
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
          hasForecastTrack && !cameraFollowsUser && !lockCameraToArea
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
      {layerSafePoints.length === 0 && !showUserPin ? (
        <Marker
          position={[area.center.lat, area.center.lng]}
          icon={hallIcon}
          zIndexOffset={750}
        >
          <Popup>
            <strong>Command center · Brgy. {area.barangay} Hall</strong>
            <br />
            {area.name}
          </Popup>
        </Marker>
      ) : null}
      {showUserPin && effectiveUser ? (
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
          </Popup>
        </Marker>
      ))}
      {layerFloods.map((fl) => {
        const floodFill =
          fl.severity === "critical"
            ? { color: "#1d4ed8", fill: "#2563eb", opacity: 0.32 }
            : fl.severity === "warning"
              ? { color: "#2563eb", fill: "#3b82f6", opacity: 0.24 }
              : { color: "#60a5fa", fill: "#93c5fd", opacity: 0.18 };
        const rings = (
          fl.footprints?.length
            ? fl.footprints
            : fl.footprint && fl.footprint.length >= 3
              ? [fl.footprint]
              : []
        ).map((ring) =>
          ring.map((p) => [p.lat, p.lng] as [number, number]),
        );
        return (
          <Fragment key={fl.id}>
            {rings.map((ring, i) => (
              <Polygon
                key={`${fl.id}-cell-${i}`}
                positions={ring}
                pathOptions={{
                  color: floodFill.color,
                  weight: 0.5,
                  opacity: 0.35,
                  fillColor: floodFill.fill,
                  fillOpacity: floodFill.opacity,
                }}
              >
                {i === 0 ? (
                  <Popup>
                    <strong>
                      Flood zone · {floodSeverityLabel(fl.severity)}
                    </strong>
                    <br />
                    {fl.name}
                    <br />
                    {fl.place}
                    <br />
                    {fl.notes}
                  </Popup>
                ) : null}
              </Polygon>
            ))}
            {!rings.length && fl.radiusM && fl.radiusM > 0 ? (
              <Circle
                center={[fl.lat, fl.lng]}
                radius={fl.radiusM}
                pathOptions={{
                  color: floodFill.color,
                  weight: 1,
                  opacity: 0.55,
                  fillColor: floodFill.fill,
                  fillOpacity: floodFill.opacity,
                }}
              />
            ) : null}
            <Marker
              position={[fl.lat, fl.lng]}
              icon={floodIcon(fl.severity)}
              zIndexOffset={650}
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
          </Fragment>
        );
      })}
      {layerTyphoons.map((ty) =>
        ty.track && ty.track.length > 1 ? (
          <Fragment key={`${ty.id}-track`}>
            <Polyline
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
            {trackEtaSamples(ty.track, {
              lat: ty.lat,
              lng: ty.lng,
              at: ty.reportedAt,
            }).map((p, i) => (
              <Marker
                key={`${ty.id}-eta-${p.at}`}
                position={[p.lat, p.lng]}
                icon={trackEtaIcon(
                  formatOdetteTrackChip(p.at!),
                  p.at === ODETTE_CEBU_LANDFALL_ISO ||
                    (p.at != null &&
                      Math.abs(
                        new Date(p.at).getTime() -
                          new Date(ODETTE_CEBU_LANDFALL_ISO).getTime(),
                      ) <
                        4 * 3_600_000),
                  i % 2 === 0 ? "above" : "below",
                )}
                zIndexOffset={720}
              >
                <Popup>
                  <strong>Track · {formatOdetteTrackChip(p.at!)} PHT</strong>
                  <br />
                  {p.label ?? ty.name}
                  <br />
                  Cebu landfall ETA ·{" "}
                  {formatOdetteTrackChip(ODETTE_CEBU_LANDFALL_ISO)} PHT
                </Popup>
              </Marker>
            ))}
          </Fragment>
        ) : null,
      )}
      {layerTyphoons.map((ty) => (
        <Fragment key={`${ty.id}-eye`}>
          <Marker
            position={[ty.lat, ty.lng]}
            icon={typhoonIcon()}
            zIndexOffset={960}
          >
            <Popup>
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
            </Popup>
          </Marker>
        );
      })}
      {layerEscapes.map((route) => {
        const path =
          route.path?.length >= 2 ? route.path : [route.from, route.to];
        const positions = path.map(
          (p) => [p.lat, p.lng] as [number, number],
        );
        // One chevron mid-route — direction to go, not a line per house.
        const tip = pointAndBearingAlongPath(path, 0.55);
        return (
          <Fragment key={`escape-${route.destinationId}`}>
            <Polyline
              positions={positions}
              pathOptions={{
                color: "#ffffff",
                weight: 8,
                opacity: 0.9,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
            <Polyline
              positions={positions}
              pathOptions={{
                color: "#c72929",
                weight: 4.5,
                opacity: 0.95,
                lineCap: "round",
                lineJoin: "round",
                dashArray: "12 10",
                className: "dro-escape-flow",
              }}
            />
            <Marker
              position={[tip.point.lat, tip.point.lng]}
              icon={escapeChevronIcon(tip.bearing)}
              zIndexOffset={900}
            >
              <Popup>
                <strong>
                  Go {route.direction} → {route.destinationName}
                  {route.routed ? " · via roads" : ""}
                </strong>
                <br />
                {route.instruction}
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
      {layerSafePoints.map((sp) => {
        const active = activeEvacIds.has(sp.id);
        const pop = evacStatusForSafePoint(sp, layerReports);
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
        return (
          <Marker
            key={sp.id}
            position={[sp.lat, sp.lng]}
            icon={facilityIcon(sp.kind)}
            zIndexOffset={z}
          >
            <Popup>
              <strong>{sp.name}</strong>
              {pop ? (
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
              ) : sp.isEvacCenter ? (
                <>
                  <br />
                  <span style={{ opacity: 0.75 }}>
                    No population report yet · EC staff can upload a field
                    report
                  </span>
                </>
              ) : null}
            </Popup>
          </Marker>
        );
      })}
      {layerResponders.map((r) => {
        const role = r.kind === "bfp" ? "Fire station (BFP)" : "Hospital";
        return (
          <Marker
            key={r.id}
            position={[r.lat, r.lng]}
            icon={facilityIcon(r.kind)}
            zIndexOffset={r.kind === "bfp" ? 730 : 725}
          >
            <Popup>
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
            </Popup>
          </Marker>
        );
      })}
      {!cameraFollowsUser &&
      (!hasForecastTrack || lockCameraToArea) ? (
        <FitHouseholds
          area={area}
          households={mapped}
          highlightIds={highlightIds}
          escapeRoutes={layerEscapes}
        />
      ) : null}
    </MapContainer>
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
