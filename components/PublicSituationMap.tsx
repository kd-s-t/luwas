"use client";

import {
  Flame,
  LocateFixed,
  Loader2,
  Mountain,
  Tornado,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CommandAreaMapMount } from "@/components/CommandAreaMapMount";
import { ScenarioMapOverlay } from "@/components/ScenarioMapOverlay";
import type { AssistEscapeRoute, AssistPriority } from "@/lib/ai/assistTypes";
import {
  loadBarangayMapSnapshot,
  type BarangayMapSnapshot,
} from "@/lib/ai/barangayMapSnapshot";
import { runLocalAssist } from "@/lib/ai/localAssist";
import { predictAiFloods } from "@/lib/ai/predictFloods";
import { getBarangayMapPack } from "@/lib/geo/barangayMapPack";
import {
  DEFAULT_MAP_AREA,
  isNangkaOpsArea,
  type MapArea,
} from "@/lib/geo/mapAreas";
import {
  fetchNearbyEarthquakes,
  type QuakeEvent,
} from "@/lib/hazards/usgsEarthquakes";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen } from "@/lib/auth/types";
import { updateHouseholdPresenceForCitizen } from "@/lib/households/api";
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
    presence: "unknown" as const,
    lastSeenLat: null,
    lastSeenLng: null,
    lastSeenArea: null,
    lastSeenAt: null,
  }));
}

export function PublicSituationMap() {
  const { profile } = useAuth();
  const nangkaHouseholds = useMemo(() => seedAsHouseholds(), []);
  const { bundle, phase } = useScenario();
  /** AI triage overlays only paint in During. */
  const triageLive = phase === "during";
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
  const [snapshot, setSnapshot] = useState<BarangayMapSnapshot | null>(null);

  const pack = useMemo(
    () => getBarangayMapPack(area, bundle),
    [area, bundle],
  );
  const nangkaOps = isNangkaOpsArea(area);

  // During only: live local triage so homepage matches command (floods + red/yellow).
  const assist = useMemo(() => {
    if (!nangkaOps || !triageLive) return null;
    try {
      return runLocalAssist({
        households: nangkaHouseholds,
        floods: pack.floods,
        landslides: pack.landslides,
        typhoons: pack.typhoons,
        floodSource: "local",
      });
    } catch {
      return null;
    }
  }, [
    nangkaOps,
    triageLive,
    nangkaHouseholds,
    pack.floods,
    pack.landslides,
    pack.typhoons,
  ]);

  const assistPriorities = useMemo(() => {
    const map: Record<string, AssistPriority> = {};
    if (!nangkaOps) return map;
    // Public roster uses public-seed-* ids — triage only in During.
    if (triageLive && assist?.actions?.length) {
      for (const a of assist.actions) map[a.householdId] = a.priority;
      return map;
    }
    for (const a of pack.scenarioActions) map[a.householdId] = a.priority;
    return map;
  }, [nangkaOps, triageLive, assist, pack.scenarioActions]);

  // During: always paint elev-grid blue tiles (client rebuild).
  const mapFloods = useMemo(() => {
    if (!nangkaOps) return [];
    if (!triageLive) return pack.floods;
    return predictAiFloods({
      typhoons: pack.typhoons,
      source: "local",
    });
  }, [nangkaOps, triageLive, pack.floods, pack.typhoons]);

  // Escape polylines / chevrons off the public map.
  const escapeRoutes: AssistEscapeRoute[] = useMemo(() => [], []);

  const mapHouseholds = nangkaOps ? nangkaHouseholds : [];

  useEffect(() => {
    const reload = () => setSnapshot(loadBarangayMapSnapshot(area.id));
    reload();
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === `luwas.barangay.publicMap.v1:${area.id}` ||
        e.key === "luwas.nangka.publicMap.v1"
      ) {
        reload();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [area.id]);

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

  const syncCitizenPresence = useCallback(
    async (lat: number, lng: number, located: MapArea) => {
      if (!isCitizen(profile)) return;
      try {
        await updateHouseholdPresenceForCitizen(
          { uid: profile.uid, email: profile.email },
          {
            lat,
            lng,
            areaLabel: `Brgy. ${located.barangay}, ${located.lgu}`,
            homeBarangay:
              profile.barangay?.trim() || DEFAULT_MAP_AREA.barangay,
            locatedBarangay: located.barangay,
          },
        );
      } catch {
        /* roster update best-effort */
      }
    },
    [profile],
  );

  const applyCoords = useCallback(
    async (lat: number, lng: number) => {
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
        void syncCitizenPresence(lat, lng, data.area);
      } catch (err) {
        setUserLocation({ lat, lng });
        const fallback: MapArea = {
          ...DEFAULT_MAP_AREA,
          id: `gps/${lat.toFixed(4)},${lng.toFixed(4)}`,
          name: "Your location",
          center: { lat, lng },
          zoom: 16,
          barangay: "Unknown",
          lgu: "Cebu",
        };
        setArea(fallback);
        setMatched(false);
        setLocateStatus("error");
        setLocateError(
          err instanceof Error ? err.message : "Could not resolve barangay",
        );
        void syncCitizenPresence(lat, lng, fallback);
      }
    },
    [syncCitizenPresence],
  );

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

  // Locate only when the map section is on screen (skip for off-screen guests).
  useEffect(() => {
    const el = document.getElementById("live-map");
    if (!el || typeof IntersectionObserver === "undefined") {
      const id = window.setTimeout(() => requestLocation(), 2500);
      return () => window.clearTimeout(id);
    }
    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (done) return;
        if (entries.some((e) => e.isIntersecting)) {
          done = true;
          io.disconnect();
          requestLocation();
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [requestLocation]);

  const hazard =
    weather &&
    isHazardousWeather(weather.weatherCode, weather.precipitationMm);
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
              {area.name}
            </h2>
            <p className="mt-2 max-w-xl text-[var(--muted)]">
              {nangkaOps ? (
                <>
                  Nangka command-center layers:{" "}
                  {NANGKA_HOUSEHOLD_TARGET.toLocaleString()} house owners
                  (PSA ~{NANGKA_CENSUS_2020.toLocaleString()} people), AI flood
                  footprints, evacuate/prepare pins, and escape lines
                  {snapshot ? " · synced from command triage" : ""}.
                </>
              ) : (
                <>
                  {area.barangay} map — each barangay has its own layers. No
                  Nangka Tino data here yet; live weather and USGS quakes
                  still show.
                </>
              )}
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
            <CommandAreaMapMount
              key={`${area.id}-${bundle.phase}`}
              area={area}
              userLocation={userLocation}
              onUserLocationChange={(loc) => {
                void applyCoords(loc.lat, loc.lng);
              }}
              households={mapHouseholds}
              quakes={quakes}
              landslides={pack.landslides}
              floods={mapFloods}
              typhoons={pack.typhoons}
              fires={pack.fires}
              reportPins={pack.reportPins}
              safePoints={pack.safePoints}
              responders={pack.responders}
              assistPriorities={assistPriorities}
              escapeRoutes={escapeRoutes}
              scenarioPhase={bundle.phase}
              scrollWheelZoom={false}
            />
            <ScenarioMapOverlay />
          </div>
          <div className="-mx-px flex gap-2 overflow-x-auto overscroll-x-contain border-t border-[var(--border)] px-3 py-2.5 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:px-4 sm:py-3 [&::-webkit-scrollbar]:hidden">
            {userLocation ? (
              <span className="inline-flex shrink-0 items-center whitespace-nowrap">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#0ea5e9]" />
                You are here
              </span>
            ) : null}
            {nangkaOps ? (
              <>
                <span className="inline-flex shrink-0 items-center whitespace-nowrap">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--danger)]" />
                  Evacuate{" "}
                  {assist?.actions.filter((a) => a.priority === "evacuate")
                    .length ?? 0}
                </span>
                <span className="inline-flex shrink-0 items-center whitespace-nowrap">
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#b8860b]" />
                  Prepare{" "}
                  {assist?.actions.filter((a) => a.priority === "prepare")
                    .length ?? 0}
                </span>
                <span className="inline-flex shrink-0 items-center whitespace-nowrap">
                  <span className="mr-1.5 inline-block h-2 w-2 bg-[#2563eb]" />
                  Floods {mapFloods.length}
                </span>
              </>
            ) : (
              <span className="shrink-0 whitespace-nowrap">
                No local hazard layers yet
              </span>
            )}
            {pack.fires.length > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                <Flame
                  className="size-3.5 shrink-0 text-[#ea580c]"
                  strokeWidth={2.5}
                  aria-hidden
                />
                Fires {pack.fires.length}
              </span>
            ) : null}
            {pack.landslides.length > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                <Mountain
                  className="size-3.5 shrink-0 text-[#8b5a2b]"
                  strokeWidth={2.5}
                  aria-hidden
                />
                Landslides {pack.landslides.length}
              </span>
            ) : null}
            {pack.typhoons.length > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
                <Tornado
                  className="size-3.5 shrink-0 text-[#1d4ed8]"
                  strokeWidth={2.5}
                  aria-hidden
                />
                Typhoon {pack.typhoons.length}
              </span>
            ) : null}
            <span className="inline-flex shrink-0 items-center whitespace-nowrap">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#b45309]" />
              Reports {pack.reportPins.length}
            </span>
            <span className="inline-flex shrink-0 items-center whitespace-nowrap">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--danger)]" />
              Quakes {quakes.length}
            </span>
            <span className="shrink-0 whitespace-nowrap text-[#9e1a1a]">
              Hall
            </span>
            <span className="shrink-0 whitespace-nowrap text-[#1d4ed8]">
              School{" "}
              {pack.safePoints.filter((p) => p.kind === "school").length}
            </span>
            <span className="shrink-0 whitespace-nowrap text-[#2e8c57]">
              Evac{" "}
              {
                pack.safePoints.filter(
                  (p) => p.kind === "evac_center" || p.isEvacCenter,
                ).length
              }
            </span>
            <span className="shrink-0 whitespace-nowrap text-[#ea580c]">
              Fire {pack.responders.filter((r) => r.kind === "bfp").length}
            </span>
            <span className="shrink-0 whitespace-nowrap text-[#be123c]">
              Hospital{" "}
              {pack.responders.filter((r) => r.kind === "hospital").length}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
