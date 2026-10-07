"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AiAssistControls } from "@/components/AiAssistControls";
import { useAiAssist } from "@/lib/ai/useAiAssist";
import { CEBU_AREA, rosterMatchesOpsArea } from "@/lib/geo/cebu";
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
import { seedHouseholds, subscribeHouseholds } from "@/lib/households/api";
import { CEBU_HOUSEHOLDS } from "@/lib/households/seed";
import type { Household } from "@/lib/households/types";
import {
  fetchCebuWeather,
  isHazardousWeather,
  type AreaWeather,
} from "@/lib/weather/openMeteo";

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
  const [households, setHouseholds] = useState<Household[]>([]);
  const [rosterReady, setRosterReady] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [weather, setWeather] = useState<AreaWeather | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [quakes, setQuakes] = useState<QuakeEvent[]>([]);
  const [quakeError, setQuakeError] = useState<string | null>(null);
  const migrateAttempted = useRef(false);
  const {
    running,
    result,
    error: assistError,
    assistPriorities,
    escapeRoutes,
    runAssist,
    clearAssist,
  } = useAiAssist();

  useEffect(() => {
    setRosterReady(false);
    migrateAttempted.current = false;
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

  const mapHouseholds = useMemo(() => {
    if (households.length > 0 && rosterMatchesOpsArea(households)) {
      return households;
    }
    return seedAsHouseholds();
  }, [households]);

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
    const weatherId = window.setInterval(loadWeather, 10 * 60 * 1000);
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
    CEBU_AREA.center.lat,
    CEBU_AREA.center.lng,
    11,
  );

  return (
    <section className="mb-8 overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)]">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
            Area · Live hazards
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide sm:text-3xl">
            {CEBU_AREA.name}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Households + samples · {mappedCount} homes ·{" "}
            {CEBU_FLOOD_SAMPLES.length} floods ·{" "}
            {CEBU_LANDSLIDE_SAMPLES.length} slides ·{" "}
            {CEBU_TYPHOON_SAMPLES.length} typhoon tracks
            {quakes.length ? ` · ${quakes.length} quakes` : ""}
            {migrating ? " · updating roster to Nangka…" : ""}
          </p>
          <a
            href={zoomUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase underline-offset-2 hover:underline"
          >
            Open Zoom Earth rain / satellite →
          </a>
        </div>

        <div
          className={`min-w-[14rem] border px-4 py-3 ${
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
            <>
              <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                {hazard ? "Watch · precip / storm" : "Conditions now"}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums">
                {Math.round(weather.temperatureC)}°
                <span className="ml-2 text-base font-normal text-[var(--muted)]">
                  {weather.label}
                </span>
              </p>
              <dl className="mt-2 grid grid-cols-3 gap-2 font-mono text-[10px] text-[var(--muted)] uppercase">
                <div>
                  <dt>Feels</dt>
                  <dd className="text-[var(--foreground)] normal-case">
                    {Math.round(weather.feelsLikeC)}°C
                  </dd>
                </div>
                <div>
                  <dt>Rain</dt>
                  <dd className="text-[var(--foreground)] normal-case">
                    {weather.precipitationMm.toFixed(1)} mm
                  </dd>
                </div>
                <div>
                  <dt>Wind</dt>
                  <dd className="text-[var(--foreground)] normal-case">
                    {Math.round(weather.windKmh)} km/h
                  </dd>
                </div>
              </dl>
              <p className="mt-2 font-mono text-[9px] text-[var(--muted)]">
                Open-Meteo · Asia/Manila
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div className="relative h-[320px] sm:h-[400px]">
        <AreaMapInner
          key="nangka-ops-map"
          households={mapHouseholds}
          quakes={quakes}
          landslides={CEBU_LANDSLIDE_SAMPLES}
          floods={CEBU_FLOOD_SAMPLES}
          typhoons={CEBU_TYPHOON_SAMPLES}
          assistPriorities={assistPriorities}
          escapeRoutes={escapeRoutes}
        />
      </div>

      <div className="border-t border-[var(--border)] px-4 py-4 sm:px-5">
        <AiAssistControls
          running={running}
          result={result}
          error={assistError}
          onClear={clearAssist}
          onRun={() =>
            runAssist({
              households: mapHouseholds,
              floods: CEBU_FLOOD_SAMPLES,
              landslides: CEBU_LANDSLIDE_SAMPLES,
              typhoons: CEBU_TYPHOON_SAMPLES,
              weatherLabel: weather?.label,
            })
          }
        />
      </div>

      <div className="grid gap-0 border-t border-[var(--border)] sm:grid-cols-2">
        <HazardList
          title="Sample · floods"
          hint="Blue squares on map · demo inundation (not live PAGASA)."
          borderClass="border-b sm:border-r"
        >
          {CEBU_FLOOD_SAMPLES.map((fl) => (
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
          ))}
        </HazardList>

        <HazardList
          title="Sample · typhoon"
          hint="Typhoon spiral icons on map · demo cyclone track (not live PAGASA)."
          borderClass="border-b"
        >
          {CEBU_TYPHOON_SAMPLES.map((ty) => (
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
          ))}
        </HazardList>

        <HazardList
          title="Sample · landslides"
          hint="Brown diamonds · demo slope incidents (not live MGB)."
          borderClass="border-b sm:border-b-0 sm:border-r"
        >
          {CEBU_LANDSLIDE_SAMPLES.map((ls) => (
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
          ))}
        </HazardList>

        <HazardList
          title="Real · earthquakes"
          hint="USGS M2.5+ last 7 days within 400 km."
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
