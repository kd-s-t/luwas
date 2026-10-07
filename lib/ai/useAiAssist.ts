"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  AssistEscapeRoute,
  AssistPriority,
  AssistResult,
} from "@/lib/ai/assistTypes";
import { enrichEscapesWithRoads } from "@/lib/geo/osrmRoute";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";
import type { Household } from "@/lib/households/types";

export function useAiAssist() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AssistResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const assistPriorities = useMemo(() => {
    const map: Record<string, AssistPriority> = {};
    if (!result) return map;
    for (const a of result.actions) {
      map[a.householdId] = a.priority;
    }
    return map;
  }, [result]);

  const escapeRoutes = useMemo((): AssistEscapeRoute[] => {
    return result?.escapes ?? [];
  }, [result]);

  const runAssist = useCallback(
    async (payload: {
      households: Household[];
      floods: FloodSample[];
      landslides: LandslideSample[];
      typhoons: TyphoonSample[];
      weatherLabel?: string;
    }) => {
      setRunning(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          throw new Error(`Assist failed (${res.status})`);
        }
        const data = (await res.json()) as AssistResult;
        // Show priorities immediately, then snap lines onto streets.
        setResult(data);

        if (data.escapes?.length) {
          const routed = await enrichEscapesWithRoads(data.escapes);
          const routedN = routed.filter((e) => e.routed).length;
          setResult({
            ...data,
            escapes: routed,
            mapHint:
              routedN > 0
                ? "Green lines follow OSM streets to the nearest safe point."
                : data.mapHint,
            summary:
              routedN > 0
                ? `${data.summary} Escape paths routed along roads (${routedN}).`
                : data.summary,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Assist failed");
      } finally {
        setRunning(false);
      }
    },
    [],
  );

  const clearAssist = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    running,
    result,
    error,
    assistPriorities,
    escapeRoutes,
    runAssist,
    clearAssist,
  };
}
