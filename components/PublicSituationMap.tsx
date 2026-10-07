"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { AiAssistControls } from "@/components/AiAssistControls";
import { useAiAssist } from "@/lib/ai/useAiAssist";
import { CEBU_AREA } from "@/lib/geo/cebu";
import { CEBU_FLOOD_SAMPLES } from "@/lib/hazards/floodSamples";
import { CEBU_LANDSLIDE_SAMPLES } from "@/lib/hazards/landslideSamples";
import { CEBU_TYPHOON_SAMPLES } from "@/lib/hazards/typhoonSamples";
import {
  fetchNearbyEarthquakes,
  zoomEarthUrl,
  type QuakeEvent,
} from "@/lib/hazards/usgsEarthquakes";
import { CEBU_HOUSEHOLDS } from "@/lib/households/seed";
import type { Household } from "@/lib/households/types";
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
  const [weather, setWeather] = useState<AreaWeather | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [quakes, setQuakes] = useState<QuakeEvent[]>([]);
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
    const id = window.setInterval(load, 10 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const hazard =
    weather &&
    isHazardousWeather(weather.weatherCode, weather.precipitationMm);
  const zoomUrl = zoomEarthUrl(
    CEBU_AREA.center.lat,
    CEBU_AREA.center.lng,
    11,
  );

  return (
    <section
      id="live-map"
      className="relative z-10 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-12 sm:px-8 sm:py-16"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs tracking-[0.25em] text-[var(--accent)] uppercase">
              Public view · Consolacion
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide sm:text-4xl">
              {CEBU_AREA.name}
            </h2>
            <p className="mt-2 max-w-xl text-[var(--muted)]">
              Live weather and earthquakes, plus sample floods, landslides, and
              typhoon tracks for the demo barangay. Officers see the full
              roster after login.
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

        <div className="overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)]">
          <div className="relative h-[360px] sm:h-[440px]">
            <AreaMapInner
              households={households}
              quakes={quakes}
              landslides={CEBU_LANDSLIDE_SAMPLES}
              floods={CEBU_FLOOD_SAMPLES}
              typhoons={CEBU_TYPHOON_SAMPLES}
              assistPriorities={assistPriorities}
              escapeRoutes={escapeRoutes}
            />
          </div>
          <div className="border-t border-[var(--border)] px-4 py-4">
            <AiAssistControls
              running={running}
              result={result}
              error={assistError}
              onClear={clearAssist}
              onRun={() =>
                runAssist({
                  households,
                  floods: CEBU_FLOOD_SAMPLES,
                  landslides: CEBU_LANDSLIDE_SAMPLES,
                  typhoons: CEBU_TYPHOON_SAMPLES,
                  weatherLabel: weather?.label,
                })
              }
            />
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border)] px-4 py-3 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--accent)] align-middle" />
              Households {households.length}
            </span>
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 bg-[#2563eb] align-middle" />
              Floods {CEBU_FLOOD_SAMPLES.length}
            </span>
            <span>
              <span className="mr-1.5 inline-block h-2 w-2 rotate-45 bg-[#8b5a2b] align-middle" />
              Landslides {CEBU_LANDSLIDE_SAMPLES.length}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <svg
                viewBox="0 0 32 32"
                width="14"
                height="14"
                aria-hidden
                className="shrink-0"
              >
                <circle
                  cx="16"
                  cy="16"
                  r="14"
                  fill="#dbeafe"
                  stroke="#1d4ed8"
                  strokeWidth="1.5"
                />
                <path
                  fill="#2563eb"
                  d="M16 4c4.2 1.2 7.5 4.2 8.8 8.2-2.8-1.8-6-2.6-8.8-2.4V4z"
                />
                <path
                  fill="#1d4ed8"
                  d="M28 16c-1.2 4.2-4.2 7.5-8.2 8.8 1.8-2.8 2.6-6 2.4-8.8H28z"
                />
                <path
                  fill="#3b82f6"
                  d="M16 28c-4.2-1.2-7.5-4.2-8.8-8.2 2.8 1.8 6 2.6 8.8 2.4V28z"
                />
                <circle
                  cx="16"
                  cy="16"
                  r="4"
                  fill="#fff"
                  stroke="#1e40af"
                  strokeWidth="1.5"
                />
                <circle cx="16" cy="16" r="1.5" fill="#1e40af" />
              </svg>
              Typhoon {CEBU_TYPHOON_SAMPLES.length}
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
