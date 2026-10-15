"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, Package } from "lucide-react";
import { CommandAreaMapMount } from "@/components/CommandAreaMapMount";
import { ScenarioSwitcher } from "@/components/ScenarioSwitcher";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import {
  getBarangayMapPack,
  mapAreaFromReportScope,
} from "@/lib/geo/barangayMapPack";
import {
  DEFAULT_MAP_AREA,
  listMapAreaOptions,
  resolveMapArea,
  type MapArea,
} from "@/lib/geo/mapAreas";
import { officerReportScope } from "@/lib/reports/barangayScope";
import { getPreferredAreaId } from "@/lib/onboarding/types";
import { useScenario } from "@/lib/scenarios";
import type { ScenarioReportPin } from "@/lib/scenarios/types";
import type { AttentionItem } from "@/lib/workspace/attentionBoard";

type OverviewMapPanelProps = {
  items: AttentionItem[];
};

function kindToPin(
  item: AttentionItem,
): ScenarioReportPin["kind"] {
  if (item.kind === "critical") return "warning";
  if (item.kind === "resource") return "blockage";
  return "evac_status";
}

export function OverviewMapPanel({ items }: OverviewMapPanelProps) {
  const { profile } = useAuth();
  const { officerBundle, phase, setPhase, bundle, simulationOn, tinoActive } =
    useScenario();
  const [mapArea, setMapArea] = useState<MapArea>(DEFAULT_MAP_AREA);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const wanted = params.get("area") || getPreferredAreaId();
        if (wanted) {
          const option = listMapAreaOptions().find((o) => o.id === wanted);
          if (option) {
            const { getOnboardedBarangay } = await import(
              "@/lib/onboarding/storage"
            );
            const onboarded = getOnboardedBarangay(option.id);
            if (!cancelled) {
              setMapArea(resolveMapArea(option, onboarded));
            }
            return;
          }
        }
      } catch {
        /* fall through */
      }
      if (cancelled) return;
      if (isOfficer(profile)) {
        setMapArea(mapAreaFromReportScope(officerReportScope(profile.orgName)));
      } else {
        setMapArea(DEFAULT_MAP_AREA);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const pack = useMemo(
    () => getBarangayMapPack(mapArea, officerBundle),
    [mapArea, officerBundle],
  );

  const reportPins = useMemo(() => {
    const fromAttention: ScenarioReportPin[] = items
      .filter((i) => i.lat != null && i.lng != null)
      .map((i) => ({
        id: i.reportId,
        title: i.headline,
        kind: kindToPin(i),
        lat: i.lat!,
        lng: i.lng!,
        purokHint: i.incidentCode,
        sourceLabel: "Attention",
        notes: i.detail,
        reportedAt: new Date().toISOString(),
        href: i.ctaHref,
      }));
    if (fromAttention.length > 0) return fromAttention;
    return officerBundle.reportPins;
  }, [items, officerBundle.reportPins]);

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide text-[var(--foreground)]">
            Situation map
          </h2>
          {simulationOn ? (
            <ScenarioSwitcher phase={phase} onChange={setPhase} />
          ) : null}
        </div>
        <Link
          href="/admin/full"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-[#2f5f9e] transition hover:underline"
        >
          Open full map →
        </Link>
      </div>

      <div className="relative h-[min(52dvh,420px)] bg-[var(--surface-panel)]">
        <CommandAreaMapMount
          key={`${mapArea.id}-${phase}-overview`}
          area={mapArea}
          lockCameraToArea
          households={[]}
          quakes={[]}
          landslides={pack.landslides}
          floods={pack.floods}
          typhoons={pack.typhoons}
          fires={pack.fires}
          reportPins={reportPins}
          safePoints={pack.safePoints}
          responders={[]}
          scenarioPhase={phase}
        />

        <div className="pointer-events-none absolute top-3 left-3 z-[1000] max-w-[12.5rem] rounded-xl border border-white/80 bg-white/95 p-3 text-[11px] shadow-md backdrop-blur-sm">
          <p className="mb-2 font-medium text-[var(--foreground)]">Legend</p>
          <ul className="space-y-1.5 text-[var(--muted)]">
            <li className="flex items-center gap-2">
              <AlertTriangle className="size-3.5 text-[#c72929]" aria-hidden />
              Urgent incident
            </li>
            <li className="flex items-center gap-2">
              <Package className="size-3.5 text-[#d97706]" aria-hidden />
              Resource need
            </li>
            <li className="flex items-center gap-2">
              <FileText className="size-3.5 text-[#3b6fb6]" aria-hidden />
              Pending approval
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[#94a3b8]" aria-hidden />
              Other report
            </li>
            <li className="flex items-center gap-2">
              <span
                className="size-3 rounded-sm bg-[#f9a8d4]/70 ring-1 ring-[#ec4899]/40"
                aria-hidden
              />
              Affected area
            </li>
          </ul>
        </div>
      </div>

      <p className="border-t border-[var(--border)] px-4 py-2.5 text-[11px] leading-snug text-[var(--muted)] sm:px-5">
        {tinoActive
          ? `${bundle.shortLabel} · illustrative multi-area view. Marker positions are not verified; no safe route is shown.`
          : "Today · live — marker positions from verified reports and hall pin."}
      </p>
    </section>
  );
}
