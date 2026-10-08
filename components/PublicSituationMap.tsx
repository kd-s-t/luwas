"use client";

import dynamic from "next/dynamic";
import {
  Flame,
  LocateFixed,
  Loader2,
  Mountain,
  Tornado,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AssistPriority } from "@/lib/ai/assistTypes";
import { DEFAULT_MAP_AREA, type MapArea } from "@/lib/geo/mapAreas";
import { useRoadEscapes } from "@/lib/geo/useRoadEscapes";
import {
  fetchNearbyEarthquakes,
  zoomEarthUrl,
  type QuakeEvent,
} from "@/lib/hazards/usgsEarthquakes";
import {
  CEBU_HOUSEHOLDS,
  NANGKA_CENSUS_2020,
  NANGKA_HOUSEHOLD_TARGET,
} from "@/lib/households/seed";
import type { Household } from "@/lib/households/types";
import { useScenario } from "@/lib/scenarios";
import {
  fetchCebuWeather,
  isHazardousWeather,
  type AreaWeather,
} from "@/lib/weather/openMeteo";

const AreaMapInner = dynamic(() => import("@/components/AreaMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] items-center justify-center bg-[var(--surface-panel)] font-mono text-xs text-[var(--muted)] sm:h-[440px]">
      Loading map…
    </div>
  ),
});

type LocateStatus =
  | "idle"
  | "prompting"
  | "locating"
  | "ready"
  | "denied"
  | "error";

type LocateApiResponse = {
  area: MapArea;
  matched: boolean;
  displayName: string;
  user: { lat: number; lng: number };
};

function seedAsHouseholds(): Household[] {
  return CEBU_HOUSEHOLDS.map((h, i) => ({
    id: `public-seed-${i}`,
    ownerName: h.ownerName,
    address: h.address,
    purok: h.purok,
    phone: h.phone,
    email: h.email,
    notes: h.notes,
    lat: h.lat ?? null,
    lng: h.lng ?? null,
    officerUid: "public",
    orgName: "Brgy. Nangka MDRRMO",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

export function PublicSituationMap() {
  const households = useMemo(() => seedAsHouseholds(), []);
  const { bundle } = useScenario();
  // Crow-flies first; OSRM street routing is deferred (slow public routers).
  const roadEscapes = useRoadEscapes(bundle.escapes, { deferMs: 1200 });
  const assistPriorities = useMemo(() => {
    const map: Record<string, AssistPriority> = {};
    for (const a of bundle.actions) {
      map[a.householdId] = a.priority;
    }
    return map;
  }, [bundle.actions]);

  const [weather, setWeather] = useState<AreaWeather | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [quakes, setQuakes] = useState<QuakeEvent[]>([]);
  const [area, setArea] = useState<MapArea>(DEFAULT_MAP_AREA);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locateStatus, setLocateStatus] = useState<LocateStatus>("prompting");
  const [locateError, setLocateError] = useState<string | null>(null);
  const [matched, setMatched] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [w, q] = await Promise.all([
          fetchCebuWeather(),
          fetchNearbyEarthquakes(400),
        ]);
        if (cancelled) return;
        setWeather(w);
        setWeatherError(null);
        setQuakes(q);
      } catch (err) {
        if (!cancelled) {
          setWeatherError(
            err instanceof Error ? err.message : "Live feeds unavailable",
          );
        }
      }
    }

    load();
    const id = window.setInterval(load, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const applyCoords = useCallback(async (lat: number, lng: number) => {
    setLocateStatus("locating");
    setLocateError(null);
    try {
      const res = await fetch(
        `/api/geo/locate?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
      );
      if (!res.ok) throw new Error("Could not resolve barangay");
      const data = (await res.json()) as LocateApiResponse;
      setArea(data.area);
      setUserLocation(data.user);
      setMatched(data.matched);
      setLocateStatus("ready");
    } catch (err) {
      setUserLocation({ lat, lng });
      setArea({
        ...DEFAULT_MAP_AREA,
        id: `gps/${lat.toFixed(4)},${lng.toFixed(4)}`,
        name: "Your location",
        center: { lat, lng },
        zoom: 16,
      });
      setMatched(false);
      setLocateStatus("error");
      setLocateError(
        err instanceof Error ? err.message : "Could not resolve barangay",
      );
    }
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocateStatus("error");
      setLocateError("Geolocation is not supported in this browser.");
      return;
    }

    setLocateStatus("locating");
    setLocateError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void applyCoords(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocateStatus("denied");
          setLocateError("Location permission denied.");
        } else {
          setLocateStatus("error");
          setLocateError(err.message || "Could not read your location.");
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 5 * 60_000,
      },
    );
  }, [applyCoords]);

  // Defer locate so the map paints first
  useEffect(() => {
    const id = window.setTimeout(() => requestLocation(), 1500);
    return () => window.clearTimeout(id);
  }, [requestLocation]);

  const hazard =
    weather &&
    isHazardousWeather(weather.weatherCode, weather.precipitationMm);
  const mapCenter = DEFAULT_MAP_AREA.center;
  const zoomUrl = zoomEarthUrl(mapCenter.lat, mapCenter.lng, 11);

  const locateEyebrow =
    locateStatus === "ready"
      ? matched
        ? `Located · Brgy. ${area.barangay}`
        : "Located · approximate"
      : locateStatus === "locating"
        ? "Finding your barangay…"
        : null;

  return (
    <section
      id="live-map"
      className="relative z-10 border-t border-[var(--border)] bg-[var(--surface)] pt-12 sm:pt-16"
    >
      <div className="w-full">
        <div className="mb-6 flex flex-col gap-4 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-8">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs tracking-[0.25em] text-[var(--accent)] uppercase">
              Live map
              {locateEyebrow ? ` · ${locateEyebrow}` : ""}
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide sm:text-4xl">
              {DEFAULT_MAP_AREA.name}
            </h2>
            <p className="mt-2 max-w-xl text-[var(--muted)]">
              {NANGKA_HOUSEHOLD_TARGET.toLocaleString()} demo households · ~
              {NANGKA_CENSUS_2020.toLocaleString()} people (PSA 2020) as small
              house pins off the road. Hazard layers and Odette priorities for
              training, plus live weather and USGS quakes.
            </p>

            {(locateStatus === "prompting" ||
              locateStatus === "locating" ||
              locateStatus === "denied" ||
              locateStatus === "error") && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={requestLocation}
                  disabled={locateStatus === "locating"}
                  className="inline-flex items-center gap-2 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 font-mono text-[10px] tracking-wider text-[var(--foreground)] uppercase transition hover:border-[var(--accent)] disabled:opacity-60"
                >
                  {locateStatus === "locating" ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <LocateFixed className="size-3.5" aria-hidden />
                  )}
                  {locateStatus === "locating"
                    ? "Locating…"
                    : locateStatus === "denied" || locateStatus === "error"
                      ? "Try location again"
                      : "Use my location"}
                </button>
                {locateError ? (
                  <p className="text-xs text-[var(--danger)]">{locateError}</p>
                ) : null}
              </div>
            )}

            <a
              href={zoomUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase underline-offset-2 hover:underline"
            >
              Open Zoom Earth rain / satellite →
            </a>
          </div>

          <div
            className={`min-w-[13rem] border px-4 py-3 ${
              hazard
                ? "border-[var(--warn)] bg-[var(--warn)]/10"
                : "border-[var(--border)] bg-[var(--surface-raised)]"
            }`}
          >
            {weatherError && !weather ? (
              <p className="text-xs text-[var(--danger)]">{weatherError}</p>
            ) : weather ? (
              <>
                <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                  Conditions now
                </p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums">
                  {Math.round(weather.temperatureC)}°
                  <span className="ml-2 text-base font-normal text-[var(--muted)]">
                    {weather.label}
                  </span>
                </p>
                <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">
                  Rain {weather.precipitationMm.toFixed(1)} mm · Wind{" "}
                  {Math.round(weather.windKmh)} km/h
                </p>
              </>
            ) : (
              <p className="font-mono text-xs text-[var(--muted)]">
                Loading weather…
              </p>
            )}
          </div>
        </div>

        <div className="w-full overflow-hidden border-y border-[var(--border)] bg-[var(--surface-raised)]">
          <div className="relative h-[360px] sm:h-[440px] lg:h-[min(70vh,720px)]">
            <AreaMapInner
              area={DEFAULT_MAP_AREA}
              userLocation={userLocation}
              onUserLocationChange={(loc) => {
                void applyCoords(loc.lat, loc.lng);
              }}
              forceLayers
              households={households}
              quakes={quakes}
              landslides={bundle.landslides}
              floods={bundle.floods}
              typhoons={bundle.typhoons}
              fires={bundle.fires}
              reportPins={bundle.reportPins}
              assistPriorities={assistPriorities}
              escapeRoutes={roadEscapes}
            />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border)] px-4 py-3 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
            {userLocation ? (
              <span>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#0ea5e9] align-middle" />
                You are here
              </span>
            ) : null}
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--danger)] align-middle" />
              Evacuate{" "}
              {bundle.needs.filter((n) => n.priority === "evacuate").length}
            </span>
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 bg-[#2563eb] align-middle" />
              Floods {bundle.floods.length}
            </span>
            {bundle.fires.length > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Flame
                  className="size-3.5 shrink-0 text-[#ea580c]"
                  strokeWidth={2.5}
                  aria-hidden
                />
                Fires {bundle.fires.length}
              </span>
            ) : null}
            {bundle.landslides.length > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Mountain
                  className="size-3.5 shrink-0 text-[#8b5a2b]"
                  strokeWidth={2.5}
                  aria-hidden
                />
                Landslides {bundle.landslides.length}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Tornado
                className="size-3.5 shrink-0 text-[#1d4ed8]"
                strokeWidth={2.5}
                aria-hidden
              />
              Typhoon {bundle.typhoons.length}
            </span>
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#b45309] align-middle" />
              Reports {bundle.reportPins.length}
            </span>
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--danger)] align-middle" />
              Quakes {quakes.length}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
