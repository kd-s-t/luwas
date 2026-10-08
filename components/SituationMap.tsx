"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AreaSearchSelect } from "@/components/AreaSearchSelect";
import { MangluluwasChat } from "@/components/MangluluwasChat";
import type {
  AssistEscapeRoute,
  AssistPriority,
} from "@/lib/ai/assistTypes";
import { useAiAssist } from "@/lib/ai/useAiAssist";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import { rosterMatchesOpsArea } from "@/lib/geo/cebu";
import {
  getBarangayMapPack,
  householdsInArea,
  mapAreaFromReportScope,
} from "@/lib/geo/barangayMapPack";
import {
  DEFAULT_MAP_AREA,
  isNangkaOpsArea,
  type MapArea,
} from "@/lib/geo/mapAreas";
import { useRoadEscapes } from "@/lib/geo/useRoadEscapes";
import {
  CEBU_FLOOD_SAMPLES,
  floodSeverityLabel,
} from "@/lib/hazards/floodSamples";
import {
  CEBU_LANDSLIDE_SAMPLES,
  landslideSeverityLabel,
} from "@/lib/hazards/landslideSamples";
import {
  CEBU_TYPHOON_SAMPLES,
  typhoonCategoryLabel,
} from "@/lib/hazards/typhoonSamples";
import {
  fetchNearbyEarthquakes,
  zoomEarthUrl,
  type QuakeEvent,
} from "@/lib/hazards/usgsEarthquakes";
import {
  ensureCuratedHouseholds,
  seedHouseholds,
  subscribeHouseholds,
} from "@/lib/households/api";
import {
  CEBU_HOUSEHOLDS,
  NANGKA_CENSUS_2020,
  NANGKA_HOUSEHOLD_TARGET,
} from "@/lib/households/seed";
import type { Household } from "@/lib/households/types";
import { officerReportScope } from "@/lib/reports/barangayScope";
import { useScenario } from "@/lib/scenarios";
import {
  fetchCebuWeather,
  isHazardousWeather,
  type AreaWeather,
} from "@/lib/weather/openMeteo";

const EMPTY_ESCAPES: AssistEscapeRoute[] = [];

function seedAsHouseholds(): Household[] {
  return CEBU_HOUSEHOLDS.map((h, i) => ({
    id: `seed-${i}`,
    ownerName: h.ownerName,
    address: h.address,
    purok: h.purok,
    phone: h.phone,
    email: h.email,
    notes: h.notes,
    lat: h.lat ?? null,
    lng: h.lng ?? null,
    officerUid: "seed",
    orgName: "Brgy. Nangka MDRRMO",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

const AreaMapInner = dynamic(() => import("@/components/AreaMapInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[var(--surface)] font-mono text-xs text-[var(--muted)]">
      Loading map…
    </div>
  ),
});

type SituationMapProps = {
  officerUid: string;
};

export function SituationMap({ officerUid }: SituationMapProps) {
  const { profile } = useAuth();
  const defaultArea = useMemo(() => {
    if (isOfficer(profile)) {
      return mapAreaFromReportScope(officerReportScope(profile.orgName));
    }
    return DEFAULT_MAP_AREA;
  }, [profile]);
  const [mapArea, setMapArea] = useState<MapArea>(defaultArea);
  const areaBootstrapped = useRef(false);
  useEffect(() => {
    if (areaBootstrapped.current) return;
    areaBootstrapped.current = true;
    setMapArea(defaultArea);
  }, [defaultArea]);

  const { officerBundle: scenario } = useScenario();
  const pack = useMemo(
    () => getBarangayMapPack(mapArea, scenario),
    [mapArea, scenario],
  );
  const scenarioPriorities = useMemo(() => {
    const map: Record<string, AssistPriority> = {};
    for (const a of pack.scenarioActions) map[a.householdId] = a.priority;
    return map;
  }, [pack.scenarioActions]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [rosterReady, setRosterReady] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [weather, setWeather] = useState<AreaWeather | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [quakes, setQuakes] = useState<QuakeEvent[]>([]);
  const [quakeError, setQuakeError] = useState<string | null>(null);
  const migrateAttempted = useRef(false);
  const curatedSynced = useRef(false);
  const nangkaOps = isNangkaOpsArea(mapArea);
  const {
    running,
    messages,
    result,
    error: assistError,
    model,
    setModel,
    activeChatId,
    chats,
    assistPriorities,
    escapeRoutes,
    callListVisible,
    sendMessage,
    clearCallList,
    newChat,
    selectChat,
    deleteChat,
  } = useAiAssist();
  const hasAiOverlay = Object.keys(assistPriorities).length > 0;
  const scenarioEscapes = useRoadEscapes(
    nangkaOps && !hasAiOverlay ? pack.scenarioEscapes : EMPTY_ESCAPES,
    { deferMs: 800 },
  );

  useEffect(() => {
    setRosterReady(false);
    migrateAttempted.current = false;
    curatedSynced.current = false;
    return subscribeHouseholds(officerUid, (rows) => {
      setHouseholds(rows);
      setRosterReady(true);
    });
  }, [officerUid]);

  // Old Mabolo (or empty) Firestore roster keeps the map on the wrong area —
  // replace with Nangka seed once per session when pins are outside ops.
  useEffect(() => {
    if (!rosterReady || migrateAttempted.current || migrating) return;
    if (households.length > 0 && rosterMatchesOpsArea(households)) return;

    migrateAttempted.current = true;
    setMigrating(true);
    seedHouseholds(officerUid, "Brgy. Nangka MDRRMO", CEBU_HOUSEHOLDS)
      .catch(() => {
        /* keep seed fallback on map */
      })
      .finally(() => setMigrating(false));
  }, [rosterReady, households, officerUid, migrating]);

  // Add Ken / other curated pins if roster was seeded before they existed.
  useEffect(() => {
    if (!rosterReady || migrating || curatedSynced.current) return;
    if (households.length === 0 || !rosterMatchesOpsArea(households)) return;
    curatedSynced.current = true;
    void ensureCuratedHouseholds(
      officerUid,
      "Brgy. Nangka MDRRMO",
      households,
    ).catch(() => {
      curatedSynced.current = false;
    });
  }, [rosterReady, migrating, households, officerUid]);

  const mapHouseholds = useMemo(() => {
    if (!nangkaOps) {
      return householdsInArea(households, mapArea);
    }
    if (households.length > 0 && rosterMatchesOpsArea(households)) {
      return households;
    }
    return seedAsHouseholds();
  }, [households, nangkaOps, mapArea]);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather() {
      setWeatherLoading(true);
      try {
        const w = await fetchCebuWeather();
        if (!cancelled) {
          setWeather(w);
          setWeatherError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setWeatherError(
            err instanceof Error ? err.message : "Weather unavailable",
          );
        }
      } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    }

    async function loadQuakes() {
      try {
        const q = await fetchNearbyEarthquakes(400);
        if (!cancelled) {
          setQuakes(q);
          setQuakeError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setQuakeError(
            err instanceof Error ? err.message : "Earthquake feed unavailable",
          );
        }
      }
    }

    loadWeather();
    loadQuakes();
    const weatherId = window.setInterval(loadWeather, 30 * 60 * 1000);
    const quakeId = window.setInterval(loadQuakes, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(weatherId);
      window.clearInterval(quakeId);
    };
  }, []);

  const mappedCount = mapHouseholds.filter(
    (h) => h.lat != null && h.lng != null,
  ).length;
  const hazard =
    weather &&
    isHazardousWeather(weather.weatherCode, weather.precipitationMm);
  const zoomUrl = zoomEarthUrl(
    mapArea.center.lat,
    mapArea.center.lng,
    11,
  );
  const mapPriorities = nangkaOps
    ? hasAiOverlay
      ? assistPriorities
      : scenarioPriorities
    : {};
  const mapEscapes = nangkaOps
    ? hasAiOverlay
      ? escapeRoutes
      : scenarioEscapes
    : [];
  // Flood footprints only after Run triage on Nangka (AI prediction).
  const mapFloods =
    nangkaOps && result?.predictedFloods?.length
      ? result.predictedFloods
      : [];

  return (
    <section className="w-full border-b border-[var(--border)] bg-[var(--surface-raised)]">
      <div className="relative z-30 flex flex-col gap-2.5 border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="relative z-30 min-w-0">
          <AreaSearchSelect value={mapArea} onChange={setMapArea} />
          <p className="mt-1 text-xs text-[var(--muted)] sm:text-sm">
            {nangkaOps ? (
              <>
                {mappedCount.toLocaleString()} homes
                {mappedCount >= NANGKA_HOUSEHOLD_TARGET
                  ? ` · ~${NANGKA_CENSUS_2020.toLocaleString()} people (PSA 2020)`
                  : ""}{" "}
                · {mapFloods.length} AI floods ·{" "}
                {pack.landslides.length} slides · {pack.typhoons.length} typhoon
                · {pack.fires.length} fire · {pack.reportPins.length} reports
                {quakes.length ? ` · ${quakes.length} quakes` : ""}
                {migrating ? " · updating roster…" : ""}
              </>
            ) : (
              <>
                {mapArea.barangay} map · no local hazard layers yet
                {quakes.length ? ` · ${quakes.length} quakes` : ""}
              </>
            )}
            {" · "}
            <a
              href={zoomUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase underline-offset-2 hover:underline"
            >
              Zoom Earth →
            </a>
          </p>
        </div>

        <div
          className={`shrink-0 border px-3 py-2 sm:min-w-[16rem] ${
            hazard
              ? "border-[var(--warn)] bg-[var(--warn)]/10"
              : "border-[var(--border)] bg-[var(--surface)]"
          }`}
        >
          {weatherLoading && !weather ? (
            <p className="font-mono text-xs text-[var(--muted)]">
              Fetching weather…
            </p>
          ) : weatherError && !weather ? (
            <p className="text-xs text-[var(--danger)]">{weatherError}</p>
          ) : weather ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                  {hazard ? "Watch" : "Now"}
                </p>
                <p className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-none tabular-nums">
                  {Math.round(weather.temperatureC)}°
                  <span className="ml-1.5 text-sm font-normal text-[var(--muted)]">
                    {weather.label}
                  </span>
                </p>
              </div>
              <dl className="grid grid-cols-3 gap-x-3 border-l border-[var(--border)] pl-3 font-mono text-[9px] text-[var(--muted)] uppercase">
                <div>
                  <dt>Feels</dt>
                  <dd className="text-[var(--foreground)] normal-case">
                    {Math.round(weather.feelsLikeC)}°
                  </dd>
                </div>
                <div>
                  <dt>Rain</dt>
                  <dd className="text-[var(--foreground)] normal-case">
                    {weather.precipitationMm.toFixed(1)}
                  </dd>
                </div>
                <div>
                  <dt>Wind</dt>
                  <dd className="text-[var(--foreground)] normal-case">
                    {Math.round(weather.windKmh)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </div>

      <div className="relative z-0 grid overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(320px,28vw)]">
        <div className="relative z-0 h-[min(62dvh,560px)] sm:h-[min(68dvh,680px)] lg:h-[calc(100dvh-11rem)]">
          <AreaMapInner
            key={mapArea.id}
            area={mapArea}
            households={mapHouseholds}
            quakes={quakes}
            landslides={pack.landslides}
            floods={mapFloods}
            typhoons={pack.typhoons}
            fires={pack.fires}
            reportPins={pack.reportPins}
            safePoints={pack.safePoints}
            assistPriorities={mapPriorities}
            escapeRoutes={mapEscapes}
          />
        </div>
        <aside className="h-[min(62dvh,560px)] border-t border-[var(--border)] sm:h-[min(68dvh,680px)] lg:h-[calc(100dvh-11rem)] lg:border-t-0 lg:border-l">
          <MangluluwasChat
            className="border-0"
            messages={messages}
            running={running}
            result={result}
            households={mapHouseholds}
            error={assistError}
            model={model}
            onModelChange={setModel}
            callListVisible={callListVisible}
            onClearCallList={clearCallList}
            chats={chats}
            activeChatId={activeChatId}
            onNewChat={newChat}
            onSelectChat={selectChat}
            onDeleteChat={deleteChat}
            onSend={(text) =>
              sendMessage(text, {
                households: mapHouseholds,
                floods: mapFloods.length
                  ? mapFloods
                  : nangkaOps
                    ? CEBU_FLOOD_SAMPLES
                    : [],
                landslides: pack.landslides.length
                  ? pack.landslides
                  : nangkaOps
                    ? CEBU_LANDSLIDE_SAMPLES
                    : [],
                typhoons: pack.typhoons.length
                  ? pack.typhoons
                  : nangkaOps
                    ? CEBU_TYPHOON_SAMPLES
                    : [],
                weatherLabel: weather?.label,
                model,
              })
            }
          />
        </aside>
      </div>

      <div className="grid gap-0 border-t border-[var(--border)] sm:grid-cols-2">
        <HazardList
          title="Floods"
          hint="Run triage sets these AI flood footprints. Clear list hides the call sheet — map stays."
          borderClass="border-b sm:border-r"
        >
          {mapFloods.length === 0 ? (
            <li className="px-3 py-4 text-sm text-[var(--muted)]">
              No AI flood prediction yet — run triage.
            </li>
          ) : (
            mapFloods.map((fl) => (
              <li
                key={fl.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <span>
                  <span
                    className={`font-mono text-[10px] uppercase ${
                      fl.severity === "critical"
                        ? "text-[var(--danger)]"
                        : fl.severity === "warning"
                          ? "text-[var(--warn)]"
                          : "text-[var(--muted)]"
                    }`}
                  >
                    {floodSeverityLabel(fl.severity)}
                  </span>{" "}
                  {fl.name}
                  <span className="text-[var(--muted)]"> · {fl.depthCm} cm</span>
                </span>
                <span className="font-mono text-[10px] text-[var(--muted)]">
                  {fl.purokHint}
                </span>
              </li>
            ))
          )}
        </HazardList>

        <HazardList
          title="Typhoon"
          hint="Eye / track from IBTrACS Odette (Rai) on this phase’s timeline."
          borderClass="border-b"
        >
          {pack.typhoons.length === 0 ? (
            <li className="px-3 py-4 text-sm text-[var(--muted)]">
              {pack.empty
                ? "No typhoon layer for this barangay yet."
                : "No typhoon pins."}
            </li>
          ) : (
            pack.typhoons.map((ty) => (
              <li
                key={ty.id}
                className="flex flex-col gap-0.5 px-3 py-2.5 text-sm"
              >
                <span>
                  <span className="font-mono text-[10px] text-[var(--accent)] uppercase">
                    {typhoonCategoryLabel(ty.category)}
                  </span>{" "}
                  {ty.name}
                </span>
                <span className="font-mono text-[10px] text-[var(--muted)]">
                  {ty.maxWindsKmh} km/h · {Math.round(ty.distanceKm)} km away ·{" "}
                  {ty.etaNote}
                </span>
              </li>
            ))
          )}
        </HazardList>

        <HazardList
          title="Landslides"
          hint="Slope incidents for this Odette phase (not a live MGB feed)."
          borderClass="border-b sm:border-b-0 sm:border-r"
        >
          {pack.landslides.length === 0 ? (
            <li className="px-3 py-4 text-sm text-[var(--muted)]">
              {pack.empty
                ? "No landslide layer for this barangay yet."
                : "No landslide pins."}
            </li>
          ) : (
            pack.landslides.map((ls) => (
              <li
                key={ls.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <span>
                  <span
                    className={`font-mono text-[10px] uppercase ${
                      ls.severity === "critical"
                        ? "text-[var(--danger)]"
                        : ls.severity === "warning"
                          ? "text-[var(--warn)]"
                          : "text-[var(--muted)]"
                    }`}
                  >
                    {landslideSeverityLabel(ls.severity)}
                  </span>{" "}
                  {ls.name}
                </span>
                <span className="font-mono text-[10px] text-[var(--muted)]">
                  {ls.purokHint}
                </span>
              </li>
            ))
          )}
        </HazardList>

        <HazardList
          title="Earthquakes"
          hint="Live USGS M2.5+ last 7 days within 400 km."
          borderClass=""
        >
          {quakeError ? (
            <li className="px-3 py-2.5 text-sm text-[var(--danger)]">
              {quakeError}
            </li>
          ) : quakes.length === 0 ? (
            <li className="px-3 py-2.5 font-mono text-xs text-[var(--muted)]">
              No M2.5+ quakes in range this week.
            </li>
          ) : (
            quakes.slice(0, 6).map((q) => (
              <li
                key={q.id}
                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-sm"
              >
                <span>
                  <span className="font-mono text-[var(--warn)]">
                    M{q.mag?.toFixed(1) ?? "?"}
                  </span>{" "}
                  {q.place}
                </span>
                <span className="font-mono text-[10px] text-[var(--muted)]">
                  {Math.round(q.distanceKm)} km
                </span>
              </li>
            ))
          )}
        </HazardList>
      </div>
    </section>
  );
}

function HazardList({
  title,
  hint,
  borderClass,
  children,
}: {
  title: string;
  hint: string;
  borderClass: string;
  children: ReactNode;
}) {
  return (
    <div className={`px-4 py-4 sm:px-5 ${borderClass} border-[var(--border)]`}>
      <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--warn)] uppercase">
        {title}
      </p>
      <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>
      <ul className="mt-3 divide-y divide-[var(--border)] border border-[var(--border)]">
        {children}
      </ul>
    </div>
  );
}
