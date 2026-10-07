"use client";

import { useEffect, useMemo, useState } from "react";
import type { AssistEscapeRoute } from "@/lib/ai/assistTypes";
import { enrichEscapesWithRoads } from "@/lib/geo/osrmRoute";

const EMPTY: AssistEscapeRoute[] = [];

type Options = {
  /** Wait before hitting public OSRM (lets the map paint first). */
  deferMs?: number;
};

/**
 * Replace crow-flies escape segments with OSM street paths.
 * Shows straight lines immediately, then upgrades when routing returns.
 */
export function useRoadEscapes(
  escapes: AssistEscapeRoute[],
  options: Options = {},
): AssistEscapeRoute[] {
  const { deferMs = 0 } = options;
  const source = escapes.length ? escapes : EMPTY;
  const fingerprint = useMemo(
    () =>
      source
        .map(
          (e) =>
            `${e.householdId}:${e.from.lat},${e.from.lng}->${e.to.lat},${e.to.lng}`,
        )
        .join("|"),
    [source],
  );
  const [routed, setRouted] = useState<AssistEscapeRoute[]>(source);

  useEffect(() => {
    let cancelled = false;
    setRouted(source);

    if (!source.length) return;

    const run = () => {
      void enrichEscapesWithRoads(source).then((next) => {
        if (!cancelled) setRouted(next);
      });
    };

    const timer =
      deferMs > 0 ? window.setTimeout(run, deferMs) : (run(), undefined);

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
    // fingerprint captures geometry; source is the matching escapes array.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fingerprint
  }, [fingerprint, deferMs]);

  return routed;
}
