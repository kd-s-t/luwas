"use client";

import { useEffect, useMemo, useState } from "react";
import { PostReportButton } from "@/components/PostReportButton";
import { PublicReportCard } from "@/components/PublicReportCard";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { LatLng } from "@/lib/geo/cebu";
import {
  reportInScope,
  scopeAnchor,
  scopeForProfile,
  scopeLabel,
  sortReportsByDistance,
} from "@/lib/reports/barangayScope";
import { captureReportMeta } from "@/lib/reports/captureMeta";
import { ensureAllMapReportsInDb } from "@/lib/reports/seedMapReport";
import { subscribePublicReports } from "@/lib/reports/socialApi";
import {
  hazardHintLabel,
  type HazardReport,
  type ReportHazardHint,
} from "@/lib/reports/types";
import { cn } from "@/lib/utils";

const HAZARD_FILTERS: { id: "all" | ReportHazardHint; label: string }[] = [
  { id: "all", label: "All" },
  { id: "typhoon", label: "Typhoon · Cat 5" },
  { id: "flood", label: "Flood" },
  { id: "landslide", label: "Landslide" },
  { id: "fire", label: "Fire" },
  { id: "evac", label: "Evacuation center" },
  { id: "other", label: "Other" },
];

function reportYear(report: HazardReport): number | null {
  const t = Date.parse(report.createdAt);
  if (Number.isNaN(t)) return null;
  return new Date(t).getFullYear();
}

function matchesSearch(report: HazardReport, q: string): boolean {
  if (!q) return true;
  const hay = [
    report.title,
    report.notes,
    report.citizenName,
    report.citizenPurok,
    report.locationLabel,
    report.hazardHint,
    hazardHintLabel(report.hazardHint),
    report.device,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function PublicReportsFeed() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<HazardReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<"all" | number>("all");
  const [category, setCategory] = useState<"all" | ReportHazardHint>("all");
  const [search, setSearch] = useState("");
  const [here, setHere] = useState<LatLng | null>(null);

  const scope = useMemo(() => scopeForProfile(profile), [profile]);
  const anchor = useMemo(() => here ?? scopeAnchor(scope), [here, scope]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    setError(null);

    void (async () => {
      try {
        await ensureAllMapReportsInDb();
      } catch (err) {
        console.warn("Map report seed failed", err);
      }
      if (cancelled) return;
      unsub = subscribePublicReports(setRows, (err) => {
        setError(err.message);
        setRows([]);
      });
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void captureReportMeta().then((meta) => {
      if (cancelled) return;
      if (meta.lat != null && meta.lng != null) {
        setHere({ lat: meta.lat, lng: meta.lng });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const scoped = useMemo(() => {
    if (!rows) return null;
    return rows.filter((r) => reportInScope(r, scope));
  }, [rows, scope]);

  const years = useMemo(() => {
    if (!scoped) return [] as number[];
    const set = new Set<number>();
    for (const r of scoped) {
      const y = reportYear(r);
      if (y != null) set.add(y);
    }
    return [...set].sort((a, b) => b - a);
  }, [scoped]);

  const filtered = useMemo(() => {
    if (!scoped) return [];
    const q = search.trim().toLowerCase();
    const matched = scoped.filter((r) => {
      if (year !== "all" && reportYear(r) !== year) return false;
      if (category !== "all" && r.hazardHint !== category) return false;
      if (!matchesSearch(r, q)) return false;
      return true;
    });
    return sortReportsByDistance(matched, anchor).map((x) => x.report);
  }, [scoped, year, category, search, anchor]);

  if (error) {
    return (
      <div className="border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-5 text-sm text-[var(--muted)]">
        <p className="font-medium text-[var(--foreground)]">
          Could not load reports
        </p>
        <p className="mt-1 font-mono text-[11px]">{error}</p>
      </div>
    );
  }

  if (rows == null || scoped == null) {
    return (
      <p className="font-mono text-sm tracking-wider text-[var(--muted)] uppercase">
        Loading reports…
      </p>
    );
  }

  const filtersActive =
    year !== "all" || category !== "all" || search.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="space-y-3 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 sm:px-4">
        <label className="block">
          <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
            Search
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, place, name, notes…"
            className="mt-1.5 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
        </label>

        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[7rem] flex-1 sm:flex-none">
            <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Year
            </span>
            <select
              value={year === "all" ? "all" : String(year)}
              onChange={(e) => {
                const v = e.target.value;
                setYear(v === "all" ? "all" : Number(v));
              }}
              className="mt-1.5 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--accent)]"
            >
              <option value="all">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[10rem] flex-[2] sm:flex-none">
            <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Category
            </span>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as "all" | ReportHazardHint)
              }
              className="mt-1.5 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--accent)]"
            >
              {HAZARD_FILTERS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label}
                </option>
              ))}
            </select>
          </label>

          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setYear("all");
                setCategory("all");
                setSearch("");
              }}
              className="border border-[var(--border)] px-3 py-2 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            >
              Clear
            </button>
          ) : null}
        </div>

        <p
          className={cn(
            "font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase",
          )}
        >
          {scopeLabel(scope)} · nearest first · showing {filtered.length} of{" "}
          {scoped.length}
        </p>
      </div>

      {scoped.length === 0 ? (
        <div className="border border-dashed border-[var(--border)] px-6 py-14 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
            No reports yet
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
            When residents post field photos in {scopeLabel(scope)}, they show
            up here.
          </p>
          <div className="mt-5 flex justify-center">
            <PostReportButton />
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-[var(--border)] px-6 py-10 text-center">
          <p className="font-medium text-[var(--foreground)]">
            No reports match
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Try another year, category, or search term.
          </p>
        </div>
      ) : (
        filtered.map((report, i) => (
          <FadeIn key={report.id} delay={Math.min(i * 0.04, 0.24)} y={12}>
            <PublicReportCard report={report} />
          </FadeIn>
        ))
      )}
    </div>
  );
}
