"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AreaSearchSelect } from "@/components/AreaSearchSelect";
import { CommandAreaMapMount } from "@/components/CommandAreaMapMount";
import { MangluluwasChat } from "@/components/MangluluwasChat";
import { ScenarioMapOverlay } from "@/components/ScenarioMapOverlay";
import type {
  AssistEscapeRoute,
  AssistPriority,
} from "@/lib/ai/assistTypes";
import { runLocalAssist } from "@/lib/ai/localAssist";
import { predictAiFloods } from "@/lib/ai/predictFloods";
import type { FloodSample } from "@/lib/hazards/floodSamples";
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
import { CEBU_FLOOD_SAMPLES } from "@/lib/hazards/floodSamples";
import { CEBU_LANDSLIDE_SAMPLES } from "@/lib/hazards/landslideSamples";
import { CEBU_TYPHOON_SAMPLES } from "@/lib/hazards/typhoonSamples";
import {
  fetchNearbyEarthquakes,
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
import { subscribeAllReports } from "@/lib/reports/api";
import { officerReportScope } from "@/lib/reports/barangayScope";
import { ensureAllMapReportsInDb } from "@/lib/reports/seedMapReport";
import type { HazardReport } from "@/lib/reports/types";
import { useScenario } from "@/lib/scenarios";
import { resolveScenarioPriorities } from "@/lib/scenarios/resolveScenarioPriorities";
import type { ScenarioReportPin } from "@/lib/scenarios/types";
import {
  fetchCebuWeather,
  isHazardousWeather,
  type AreaWeather,
} from "@/lib/weather/openMeteo";

function reportToMapPin(r: HazardReport): ScenarioReportPin | null {
  if (r.lat == null || r.lng == null) return null;
  if (r.status === "rejected") return null;
  const kind: ScenarioReportPin["kind"] =
    r.hazardHint === "flood"
      ? "flood"
      : r.hazardHint === "fire"
        ? "fire"
        : r.hazardHint === "landslide"
          ? "landslide"
          : r.hazardHint === "evac"
            ? "evac_status"
            : r.hazardHint === "blockage" || r.hazardHint === "typhoon"
              ? "blockage"
              : "warning";
  return {
    id: r.id,
    title: r.title,
    kind,
    lat: r.lat,
    lng: r.lng,
    purokHint: r.citizenPurok || "Field",
    sourceLabel: "Firestore · live",
    notes: r.notes,
    reportedAt: r.createdAt,
    mediaUrl: r.mediaUrl || undefined,
    href: `/reports/${r.id}`,
  };
}

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


type SituationMapProps = {
  officerUid: string;
  /** Fill the viewport (command /full — no site header). */
  fullViewport?: boolean;
  /** Fill remaining parent height (command map after hazard lists removed). */
  fillRemaining?: boolean;
};

export function SituationMap({
  officerUid,
  fullViewport = false,
  fillRemaining = false,
}: SituationMapProps) {
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

    async function bootArea() {
      try {
        const params = new URLSearchParams(window.location.search);
        const { getPreferredAreaId } = await import("@/lib/onboarding/types");
        const wanted = params.get("area") || getPreferredAreaId();
        if (wanted) {
          const { listMapAreaOptions } = await import("@/lib/geo/mapAreas");
          const option = listMapAreaOptions().find((o) => o.id === wanted);
          if (option) {
            const { getOnboardedBarangay } = await import(
              "@/lib/onboarding/storage"
            );
            const onboarded = getOnboardedBarangay(option.id);
            if (onboarded) {
              setMapArea({
                id: option.id,
                barangay: option.barangay,
                lgu: option.lgu,
                name: option.name,
                center: { ...onboarded.center },
                zoom: onboarded.zoom,
              });
              return;
            }
            const { resolveKnownMapArea } = await import("@/lib/geo/mapAreas");
            setMapArea(resolveKnownMapArea(option));
            return;
          }
        }
      } catch {
        /* fall through */
      }
      setMapArea(defaultArea);
    }

    void bootArea();
  }, [defaultArea]);

  const { phase, officerBundle: scenario } = useScenario();
  const pack = useMemo(
    () => getBarangayMapPack(mapArea, scenario),
    [mapArea, scenario],
  );
  const [households, setHouseholds] = useState<Household[]>([]);
  const [rosterReady, setRosterReady] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [dbReports, setDbReports] = useState<HazardReport[]>([]);
  const [weather, setWeather] = useState<AreaWeather | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [quakes, setQuakes] = useState<QuakeEvent[]>([]);
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
    callListVisible,
    sendMessage,
    clearCallList,
    newChat,
    selectChat,
    deleteChat,
    patchMessageAudio,
  } = useAiAssist({ officerUid });
  /** AI triage overlays (floods / red-yellow / escapes) only paint in During. */
  const triageLive = phase === "during";
  const hasAiOverlay =
    triageLive && Object.keys(assistPriorities).length > 0;

  useEffect(() => {
    setRosterReady(false);
    migrateAttempted.current = false;
    curatedSynced.current = false;
    return subscribeHouseholds(officerUid, (rows) => {
      setHouseholds(rows);
      setRosterReady(true);
    });
  }, [officerUid]);

  // During/After: seed curated map reports into Firestore, then live-subscribe.
  useEffect(() => {
    if (!nangkaOps || (phase !== "during" && phase !== "after")) {
      setDbReports([]);
      return;
    }
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        await ensureAllMapReportsInDb();
      } catch (err) {
        console.warn("Map report seed failed", err);
      }
      if (cancelled) return;
      unsub = subscribeAllReports(setDbReports);
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [nangkaOps, phase]);

  // Old Mabolo / empty / oversized roster → replace with Nangka house-owner seed.
  useEffect(() => {
    if (!rosterReady || migrateAttempted.current || migrating) return;
    const inOps =
      households.length > 0 && rosterMatchesOpsArea(households);
    const oversized = households.length > NANGKA_HOUSEHOLD_TARGET + 50;
    if (inOps && !oversized) return;

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

  const scenarioPriorities = useMemo(
    () => resolveScenarioPriorities(pack.scenarioActions, mapHouseholds),
    [pack.scenarioActions, mapHouseholds],
  );

  // During only: auto local triage on the live DB roster (same as homepage).
  // Chat "run triage" still wins when hasAiOverlay.
  const phaseAssist = useMemo(() => {
    if (!nangkaOps || hasAiOverlay || !triageLive) return null;
    if (mapHouseholds.length === 0) return null;
    try {
      return runLocalAssist({
        households: mapHouseholds,
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
    hasAiOverlay,
    triageLive,
    mapHouseholds,
    pack.floods,
    pack.landslides,
    pack.typhoons,
  ]);

  const phasePriorities = useMemo(() => {
    const map: Record<string, AssistPriority> = {};
    if (!phaseAssist?.actions?.length) return map;
    for (const a of phaseAssist.actions) map[a.householdId] = a.priority;
    return map;
  }, [phaseAssist]);

  const mapReportPins = useMemo(() => {
    const fromDb = dbReports
      .map(reportToMapPin)
      .filter((p): p is ScenarioReportPin => p != null);
    const merged =
      fromDb.length === 0
        ? pack.reportPins
        : (() => {
            const seen = new Set(fromDb.map((p) => p.id));
            const extras = pack.reportPins.filter((p) => !seen.has(p.id));
            return [...fromDb, ...extras];
          })();
    // During/After: drop EC occupancy + landslide pins (flood drill focus).
    if (phase === "during" || phase === "after") {
      return merged.filter(
        (p) =>
          p.kind !== "evac_status" &&
          p.kind !== "landslide" &&
          !p.id.includes("-ec-") &&
          !p.id.startsWith("rpt-ec-") &&
          !p.id.includes("landslide"),
      );
    }
    return merged;
  }, [dbReports, pack.reportPins, phase]);

  useEffect(() => {
    let cancelled = false;

    async function loadWeather(isInitial = false) {
      // Avoid a full loading flash (and remount churn) on background refresh.
      if (isInitial) setWeatherLoading(true);
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
        if (!cancelled && isInitial) setWeatherLoading(false);
      }
    }

    async function loadQuakes() {
      try {
        const q = await fetchNearbyEarthquakes(400);
        if (!cancelled) setQuakes(q);
      } catch {
        if (!cancelled) setQuakes([]);
      }
    }

    void loadWeather(true);
    void loadQuakes();
    const weatherId = window.setInterval(() => {
      void loadWeather(false);
    }, 30 * 60 * 1000);
    const quakeId = window.setInterval(() => {
      void loadQuakes();
    }, 5 * 60 * 1000);
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
  const mapPriorities = nangkaOps
    ? hasAiOverlay
      ? assistPriorities
      : Object.keys(phasePriorities).length > 0
        ? phasePriorities
        : scenarioPriorities
    : {};
  // Escape polylines / chevrons off the map (keep data for triage logic only).
  const mapEscapes = EMPTY_ESCAPES;
  // During: always rebuild elev-grid blue tiles client-side (never trust
  // slimmed chat/history payloads that drop footprints).
  const mapFloods = useMemo((): FloodSample[] => {
    if (!nangkaOps) return [];
    if (!triageLive) return pack.floods;
    return predictAiFloods({
      typhoons: pack.typhoons,
      source: result?.source === "gemini" ? "gemini" : "local",
    });
  }, [nangkaOps, triageLive, pack.floods, pack.typhoons, result?.source]);

  const fillStage = fullViewport || fillRemaining;
  const stageH = fillStage
    ? "h-full min-h-0"
    : "h-[min(62dvh,560px)] sm:h-[min(68dvh,680px)] lg:h-[calc(100dvh-11rem)]";

  const areaStats = nangkaOps ? (
    <>
      {mappedCount.toLocaleString()} house owners
      {mappedCount >= NANGKA_HOUSEHOLD_TARGET
        ? ` · PSA ~${NANGKA_CENSUS_2020.toLocaleString()} people`
        : ""}{" "}
      · {mapReportPins.length} reports
      {quakes.length ? ` · ${quakes.length} quakes` : ""}
      {migrating ? " · updating…" : ""}
    </>
  ) : (
    <>
      {mapArea.barangay} · command hall
      {pack.safePoints.filter((p) => p.kind !== "hall").length
        ? ` · ${pack.safePoints.filter((p) => p.kind !== "hall").length} EC/school`
        : ""}
      {quakes.length ? ` · ${quakes.length} quakes` : ""}
    </>
  );

  return (
    <section
      className={`w-full bg-[var(--surface-raised)] ${
        fullViewport
          ? "flex h-full max-h-dvh flex-col overflow-hidden border-0"
          : fillRemaining
            ? "flex min-h-0 flex-1 flex-col overflow-hidden"
            : "border-b border-[var(--border)]"
      }`}
    >
      <div
        className={
          fullViewport
            ? "relative z-0 grid min-h-0 flex-1 overflow-hidden grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,42%)] md:grid-rows-1 md:grid-cols-[minmax(0,1fr)_minmax(300px,30vw)]"
            : fillRemaining
              ? "relative z-0 grid min-h-0 flex-1 overflow-hidden grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,42%)] lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,28vw)]"
              : "relative z-0 grid min-h-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(320px,28vw)]"
        }
      >
        <div className={`relative z-0 overflow-hidden ${stageH}`}>
          <CommandAreaMapMount
            key={`${mapArea.id}-${phase}`}
            area={mapArea}
            lockCameraToArea
            households={mapHouseholds}
            quakes={quakes}
            landslides={pack.landslides}
            floods={mapFloods}
            typhoons={pack.typhoons}
            fires={pack.fires}
            reportPins={mapReportPins}
            safePoints={pack.safePoints}
            responders={pack.responders}
            assistPriorities={mapPriorities}
            escapeRoutes={mapEscapes}
            scenarioPhase={phase}
          />
          <ScenarioMapOverlay />
          {/* Compact weather — map bottom center */}
          <div className="pointer-events-none absolute inset-x-0 bottom-2 z-[1000] flex justify-center px-2 sm:bottom-3 sm:px-3">
            <div
              className={`pointer-events-auto max-w-[min(100%,22rem)] rounded-2xl border px-2.5 py-1.5 shadow-md backdrop-blur-md sm:max-w-none sm:rounded-full sm:px-3 ${
                hazard
                  ? "border-[var(--warn)]/50 bg-[var(--surface-raised)]/92"
                  : "border-[var(--border)] bg-[var(--surface-raised)]/90"
              }`}
            >
              {weatherLoading && !weather ? (
                <p className="font-mono text-[10px] text-[var(--muted)]">
                  Weather…
                </p>
              ) : weatherError && !weather ? (
                <p className="text-[10px] text-[var(--danger)]">{weatherError}</p>
              ) : weather ? (
                <p className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 font-mono text-[10px] text-[var(--foreground)] sm:text-[11px]">
                  <span className="font-[family-name:var(--font-display)] text-sm font-semibold tabular-nums leading-none sm:text-base">
                    {Math.round(weather.temperatureC)}°
                  </span>
                  <span className="text-[var(--muted)]">{weather.label}</span>
                  <span className="hidden text-[var(--border)] sm:inline">·</span>
                  <span className="text-[var(--muted)]">
                    feels {Math.round(weather.feelsLikeC)}°
                  </span>
                  <span className="text-[var(--muted)]">
                    rain {weather.precipitationMm.toFixed(1)}
                  </span>
                  <span className="hidden text-[var(--muted)] sm:inline">
                    wind {Math.round(weather.windKmh)}
                  </span>
                  {hazard ? (
                    <span className="font-semibold tracking-wider text-[var(--warn)] uppercase">
                      watch
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <aside
          className={`flex min-h-0 flex-col overflow-hidden border-[var(--border)] ${stageH} ${
            fullViewport
              ? "border-t md:border-t-0 md:border-l"
              : "border-t lg:border-t-0 lg:border-l"
          }`}
        >
          <div className="relative z-30 shrink-0 space-y-1 border-b border-[var(--border)] bg-[var(--surface-panel)] px-3 py-2 pr-12 sm:pr-3">
            <AreaSearchSelect value={mapArea} onChange={setMapArea} />
            <p className="text-[11px] leading-snug text-[var(--muted)] sm:truncate">
              {areaStats}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <MangluluwasChat
              className="h-full border-0"
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
              officerUid={officerUid}
              onMessageAudio={patchMessageAudio}
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
                  phase,
                })
              }
            />
          </div>
        </aside>
      </div>

    </section>
  );
}
