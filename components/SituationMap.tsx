"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AreaSearchSelect } from "@/components/AreaSearchSelect";
import {
  formatHazardWhen,
  HazardDetailDialog,
  type HazardDetail,
} from "@/components/HazardDetailDialog";
import { MangluluwasChat } from "@/components/MangluluwasChat";
import type { AssistEscapeRoute } from "@/lib/ai/assistTypes";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";
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
import { resolveScenarioPriorities } from "@/lib/scenarios/resolveScenarioPriorities";
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
  /** Fill the viewport (command /full — no site header). */
  fullViewport?: boolean;
};

export function SituationMap({
  officerUid,
  fullViewport = false,
}: SituationMapProps) {
  const { profile } = useAuth();
  const defaultArea = useMemo(() => {
    if (isOfficer(profile)) {
      return mapAreaFromReportScope(officerReportScope(profile.orgName));
    }
    return DEFAULT_MAP_AREA;
  }, [profile]);
  const [mapArea, setMapArea] = useState<MapArea>(defaultArea);
  const [hazardDetail, setHazardDetail] = useState<HazardDetail | null>(null);
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

  const { officerBundle: scenario } = useScenario();
  const pack = useMemo(
    () => getBarangayMapPack(mapArea, scenario),
    [mapArea, scenario],
  );
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
  // Escape arrows only after Mangluluwas / Run triage — never from scenario default.

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

  const scenarioPriorities = useMemo(
    () => resolveScenarioPriorities(pack.scenarioActions, mapHouseholds),
    [pack.scenarioActions, mapHouseholds],
  );

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
          setQuakes([]);
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
  const mapPriorities = nangkaOps
    ? hasAiOverlay
      ? assistPriorities
      : scenarioPriorities
    : {};
  const mapEscapes =
    nangkaOps && hasAiOverlay ? escapeRoutes : EMPTY_ESCAPES;
  // AI flood overlay wins; otherwise paint scenario pack (During/After).
  const mapFloods =
    nangkaOps && result?.predictedFloods?.length
      ? result.predictedFloods
      : nangkaOps
        ? pack.floods
        : [];

  const stageH = fullViewport
    ? "h-full min-h-0"
    : "h-[min(62dvh,560px)] sm:h-[min(68dvh,680px)] lg:h-[calc(100dvh-11rem)]";

  const areaStats = nangkaOps ? (
    <>
      {mappedCount.toLocaleString()} homes
      {mappedCount >= NANGKA_HOUSEHOLD_TARGET
        ? ` · ~${NANGKA_CENSUS_2020.toLocaleString()} people`
        : ""}{" "}
      · {pack.reportPins.length} reports
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
      className={`w-full bg-[var(--surface-raised)] ${fullViewport ? "flex h-full max-h-dvh flex-col overflow-hidden border-0" : "border-b border-[var(--border)]"}`}
    >
      <div
        className={
          fullViewport
            ? "relative z-0 grid min-h-0 flex-1 overflow-hidden grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,42%)] md:grid-rows-1 md:grid-cols-[minmax(0,1fr)_minmax(300px,30vw)]"
            : "relative z-0 grid min-h-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(320px,28vw)]"
        }
      >
        <div className={`relative z-0 overflow-hidden ${stageH}`}>
          <AreaMapInner
            key={mapArea.id}
            area={mapArea}
            lockCameraToArea
            households={mapHouseholds}
            quakes={quakes}
            landslides={pack.landslides}
            floods={mapFloods}
            typhoons={pack.typhoons}
            fires={pack.fires}
            reportPins={pack.reportPins}
            safePoints={pack.safePoints}
            responders={pack.responders}
            assistPriorities={mapPriorities}
            escapeRoutes={mapEscapes}
          />
          {/* Compact weather — map bottom center */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[1000] flex justify-center px-3">
            <div
              className={`pointer-events-auto rounded-full border px-3 py-1.5 shadow-md backdrop-blur-md ${
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
                <p className="flex items-baseline gap-2 font-mono text-[11px] text-[var(--foreground)]">
                  <span className="font-[family-name:var(--font-display)] text-base font-semibold tabular-nums leading-none">
                    {Math.round(weather.temperatureC)}°
                  </span>
                  <span className="text-[var(--muted)]">{weather.label}</span>
                  <span className="text-[var(--border)]">·</span>
                  <span className="text-[var(--muted)]">
                    feels {Math.round(weather.feelsLikeC)}°
                  </span>
                  <span className="text-[var(--muted)]">
                    rain {weather.precipitationMm.toFixed(1)}
                  </span>
                  <span className="text-[var(--muted)]">
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
          <div className="relative z-30 shrink-0 space-y-1 border-b border-[var(--border)] bg-[var(--surface-panel)] px-3 py-2 pr-14 sm:pr-3">
            <AreaSearchSelect value={mapArea} onChange={setMapArea} />
            <p className="truncate text-[11px] text-[var(--muted)]">
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
          </div>
        </aside>
      </div>

      {!fullViewport ? (
      <div className="grid gap-0 border-t border-[var(--border)] sm:grid-cols-2">
        <HazardList
          title="Floods"
          hint="Click a row for photo + details. During/After use scenario footprints; triage can replace with AI."
          borderClass="border-b sm:border-r"
        >
          {mapFloods.length === 0 ? (
            <li className="px-3 py-4 text-sm text-[var(--muted)]">
              No flood footprints on this phase — run triage or switch to During.
            </li>
          ) : (
            mapFloods.map((fl) => (
              <li key={fl.id}>
                <HazardRowButton
                  onClick={() => setHazardDetail(floodDetail(fl))}
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
                    <span className="text-[var(--muted)]">
                      {" "}
                      · {fl.depthCm} cm
                    </span>
                  </span>
                  <span className="font-mono text-[10px] text-[var(--muted)]">
                    {fl.purokHint}
                  </span>
                </HazardRowButton>
              </li>
            ))
          )}
        </HazardList>

        <HazardList
          title="Typhoon"
          hint="Click for winds, track timing, and notes. IBTrACS Odette (Rai) for this phase."
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
              <li key={ty.id}>
                <HazardRowButton
                  stacked
                  onClick={() => setHazardDetail(typhoonDetail(ty))}
                >
                  <span>
                    <span className="font-mono text-[10px] text-[var(--accent)] uppercase">
                      {typhoonCategoryLabel(ty.category)}
                    </span>{" "}
                    {ty.name}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--muted)]">
                    {ty.maxWindsKmh} km/h · {Math.round(ty.distanceKm)} km away
                    · {ty.etaNote}
                  </span>
                </HazardRowButton>
              </li>
            ))
          )}
        </HazardList>

        <HazardList
          title="Landslides"
          hint="Click a row for photo + details. Odette phase samples (not a live MGB feed)."
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
              <li key={ls.id}>
                <HazardRowButton
                  onClick={() => setHazardDetail(landslideDetail(ls))}
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
                </HazardRowButton>
              </li>
            ))
          )}
        </HazardList>

        <HazardList
          title="Earthquakes"
          hint="Click for depth/time; opens USGS when available. M2.5+ last 7 days · 400 km."
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
              <li key={q.id}>
                <HazardRowButton
                  onClick={() => setHazardDetail(quakeDetail(q))}
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
                </HazardRowButton>
              </li>
            ))
          )}
        </HazardList>
      </div>
      ) : null}

      <HazardDetailDialog
        detail={hazardDetail}
        onClose={() => setHazardDetail(null)}
      />
    </section>
  );
}

function severityTone(
  severity: "critical" | "warning" | "watch",
): NonNullable<HazardDetail["severityTone"]> {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warn";
  return "muted";
}

function floodDetail(fl: FloodSample): HazardDetail {
  return {
    title: fl.name,
    severityLabel: floodSeverityLabel(fl.severity),
    severityTone: severityTone(fl.severity),
    place: fl.place,
    purokHint: fl.purokHint,
    notes: fl.notes,
    mediaUrl: fl.mediaUrl,
    meta: [
      { label: "Depth", value: `${fl.depthCm} cm` },
      { label: "Reported", value: formatHazardWhen(fl.reportedAt) },
      {
        label: "Coords",
        value: `${fl.lat.toFixed(5)}, ${fl.lng.toFixed(5)}`,
      },
    ],
  };
}

function landslideDetail(ls: LandslideSample): HazardDetail {
  return {
    title: ls.name,
    severityLabel: landslideSeverityLabel(ls.severity),
    severityTone: severityTone(ls.severity),
    place: ls.place,
    purokHint: ls.purokHint,
    notes: ls.notes,
    mediaUrl: ls.mediaUrl,
    meta: [
      { label: "Reported", value: formatHazardWhen(ls.reportedAt) },
      {
        label: "Coords",
        value: `${ls.lat.toFixed(5)}, ${ls.lng.toFixed(5)}`,
      },
    ],
  };
}

function typhoonDetail(ty: TyphoonSample): HazardDetail {
  return {
    title: ty.name,
    severityLabel: typhoonCategoryLabel(ty.category),
    severityTone: "accent",
    place: ty.internationalName
      ? `International · ${ty.internationalName}`
      : undefined,
    notes: ty.notes,
    meta: [
      { label: "Max winds", value: `${ty.maxWindsKmh} km/h` },
      { label: "Movement", value: ty.movement },
      { label: "Distance", value: `${Math.round(ty.distanceKm)} km` },
      { label: "ETA / timing", value: ty.etaNote },
      { label: "Reported", value: formatHazardWhen(ty.reportedAt) },
      {
        label: "Eye",
        value: `${ty.lat.toFixed(3)}, ${ty.lng.toFixed(3)}`,
      },
    ],
  };
}

function quakeDetail(q: QuakeEvent): HazardDetail {
  return {
    title: q.place,
    severityLabel: `M${q.mag?.toFixed(1) ?? "?"}`,
    severityTone: "warn",
    notes: "Live USGS event · click through for instrument detail.",
    meta: [
      { label: "Distance", value: `${Math.round(q.distanceKm)} km` },
      {
        label: "Depth",
        value: q.depthKm != null ? `${q.depthKm.toFixed(1)} km` : "—",
      },
      {
        label: "Time",
        value: new Date(q.time).toLocaleString("en-PH", {
          timeZone: "Asia/Manila",
          dateStyle: "medium",
          timeStyle: "short",
        }),
      },
      {
        label: "Coords",
        value: `${q.lat.toFixed(3)}, ${q.lng.toFixed(3)}`,
      },
    ],
    externalUrl: q.url || undefined,
    externalLabel: "Open USGS event",
  };
}

function HazardRowButton({
  onClick,
  children,
  stacked = false,
}: {
  onClick: () => void;
  children: ReactNode;
  stacked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-[var(--surface-panel)]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] ${
        stacked
          ? "flex flex-col gap-0.5"
          : "flex flex-wrap items-baseline justify-between"
      }`}
    >
      {children}
    </button>
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
