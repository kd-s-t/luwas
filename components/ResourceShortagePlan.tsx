"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ShortagePlanMap } from "@/components/ShortagePlanMap";
import { upsertShortageFromPlan } from "@/lib/resourcesShortages/api";
import {
  hrefForShortageWorkflow,
  type ResourceShortage,
} from "@/lib/resourcesShortages/types";
import {
  listenSuggestionsByEpic,
  upsertSuggestionsFromPlan,
} from "@/lib/resourcesSuggestions/api";
import type {
  ResourceSuggestion,
  ResourceSuggestionRequest,
} from "@/lib/resourcesSuggestions/types";
import type { SupplyShortagePlan } from "@/lib/workspace/supplyShortagePlan";
import { cn } from "@/lib/utils";

function fmtL(n: number): string {
  return `${n.toLocaleString("en-PH")} L`;
}

function readinessTone(readiness: ResourceSuggestionRequest["readiness"]) {
  if (readiness === "ready") {
    return "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60";
  }
  if (readiness === "no_transport") {
    return "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]";
  }
  return "bg-[#fffbeb] text-[#b45309] ring-[#fde68a]";
}

export function ResourceShortagePlan({
  plan,
  placeLine,
  updatedLabel,
}: {
  plan: SupplyShortagePlan;
  placeLine: string;
  updatedLabel: string;
}) {
  const [suggestionDoc, setSuggestionDoc] =
    useState<ResourceSuggestion | null>(null);
  const [shortageDoc, setShortageDoc] = useState<ResourceShortage | null>(null);
  const [syncing, setSyncing] = useState(true);
  const shortageId = plan.code.trim().toUpperCase();

  useEffect(() => {
    let cancelled = false;
    setSyncing(true);
    void (async () => {
      try {
        const saved = await upsertShortageFromPlan(plan);
        if (!cancelled) setShortageDoc(saved);
        await upsertSuggestionsFromPlan(plan);
      } catch {
        /* rules / offline — table still falls back to plan rows */
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plan]);

  useEffect(() => {
    return listenSuggestionsByEpic(shortageId, setSuggestionDoc);
  }, [shortageId]);

  const tableRows = useMemo((): ResourceSuggestionRequest[] => {
    if (suggestionDoc?.requests.length) return suggestionDoc.requests;
    const totalGap = plan.rows.reduce((s, r) => s + Math.max(0, r.gapL), 0);
    return plan.rows.map((row) => {
      const people = Number(row.peopleLabel.replace(/[^\d]/g, "")) || 0;
      const suggested =
        row.gapL > 0 && totalGap > 0 && plan.availableL > 0
          ? Math.round((row.gapL / totalGap) * plan.availableL)
          : 0;
      return {
        community: row.community,
        barangayLabel: row.barangayLabel,
        reportId: row.reportId,
        reportIds: row.reportIds,
        people,
        needL: row.needL,
        localStockL: row.localStockL,
        gapL: row.gapL,
        suggestedAllocateL: suggested,
        readiness: row.readiness,
        readinessLabel: row.readinessLabel,
        mediaUrl: row.mediaUrl,
        lat: row.lat,
        lng: row.lng,
      };
    });
  }, [suggestionDoc, plan]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-[var(--muted)]">
            <Link
              href="/admin/resources"
              className="text-[#2f5f9e] hover:underline"
            >
              Resources
            </Link>
            <span className="mx-1.5 text-[var(--border)]">/</span>
            <span className="font-mono">{shortageId}</span>
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
            Resources
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Coordinate limited supplies and create an allocation plan.{" "}
            <span className="font-mono text-[var(--foreground)]">
              {shortageDoc?.id ?? shortageId}
            </span>
            {shortageDoc ? (
              <span className="text-[var(--muted)]"> · saved</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href="/admin/resources/suggestions"
            className="inline-flex items-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-sm transition hover:border-[var(--foreground)]/25"
          >
            View all resources suggested →
          </Link>
          <div className="text-right text-[12px] text-[var(--muted)]">
            <p>{placeLine}</p>
            <p className="mt-0.5">Last updated {updatedLabel}</p>
          </div>
        </div>
      </div>

      <label className="mt-5 block max-w-md">
        <span className="text-[11px] font-medium tracking-wide text-[var(--muted)]">
          Select resource
        </span>
        <div className="mt-1.5 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 shadow-sm">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {plan.resourceLabel}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            {plan.resourceBlurb}
          </p>
        </div>
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 shadow-sm">
          <p className="text-[12px] text-[var(--muted)]">Total needed</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-wide text-[#2f5f9e]">
            {fmtL(plan.totalNeededL)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            From {plan.communityCount}{" "}
            {plan.communityCount === 1 ? "community" : "communities"}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 shadow-sm">
          <p className="text-[12px] text-[var(--muted)]">Available supply</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-wide text-[#16794c]">
            {fmtL(plan.availableL)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            In LGU warehouse
          </p>
        </div>
        <div className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-4 py-4 shadow-sm">
          <p className="text-[12px] text-[var(--muted)]">Shortage</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-wide text-[#c72929]">
            {fmtL(plan.shortageL)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            Warehouse-only gap
          </p>
        </div>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Communities needing{" "}
              {plan.kind === "water"
                ? "drinking water"
                : plan.resourceLabel.toLowerCase()}
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">
              Plan {shortageDoc?.id ?? shortageId}
              {" · "}
              {tableRows.length}{" "}
              {tableRows.length === 1 ? "sitio" : "sitios"}
              {syncing ? " · syncing…" : ""}
            </p>
          </div>
          <Link
            href="/admin/resources/suggestions"
            className="text-[12px] font-medium text-[#2f5f9e] hover:underline"
          >
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[#f8fafc] text-[12px] text-[var(--muted)]">
                <th className="px-4 py-2.5 font-medium sm:px-5">Sitio</th>
                <th className="px-3 py-2.5 font-medium">People</th>
                <th className="px-3 py-2.5 font-medium">Need</th>
                <th className="px-3 py-2.5 font-medium">Local</th>
                <th className="px-3 py-2.5 font-medium">Gap</th>
                <th className="px-3 py-2.5 font-medium">Suggested</th>
                <th className="px-3 py-2.5 font-medium">Access</th>
                <th className="px-4 py-2.5 font-medium sm:px-5" />
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-6 text-sm text-[var(--muted)] sm:px-5"
                  >
                    No sitio suggestions for this shortage yet.
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => (
                  <tr
                    key={`${row.reportId}-${row.community}`}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <td className="px-4 py-3 sm:px-5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-[#f1f5f9] ring-1 ring-[var(--border)]">
                          {row.mediaUrl ? (
                            <Image
                              src={row.mediaUrl}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="36px"
                              unoptimized
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-[var(--foreground)]">
                            {row.community}
                          </p>
                          {row.barangayLabel ? (
                            <p className="text-[11px] text-[var(--muted)]">
                              {row.barangayLabel}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[var(--muted)]">
                      {row.people > 0 ? row.people.toLocaleString("en-PH") : "—"}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {fmtL(row.needL)}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-[var(--muted)]">
                      {fmtL(row.localStockL)}
                    </td>
                    <td className="px-3 py-3 tabular-nums font-semibold text-[#c72929]">
                      {fmtL(row.gapL)}
                    </td>
                    <td className="px-3 py-3 tabular-nums font-semibold text-[#2f5f9e]">
                      {fmtL(row.suggestedAllocateL)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                          readinessTone(row.readiness),
                        )}
                      >
                        {row.readinessLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right sm:px-5">
                      <Link
                        href={`/admin/incidents/${encodeURIComponent(row.reportId)}`}
                        className="inline-flex rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--border)] px-4 py-2.5 text-[11px] text-[var(--muted)] sm:px-5">
          Suggested liters are warehouse shares by gap. Local stock is
          provisional; confirm before allocation.
        </p>
      </section>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        <div className="flex min-w-0 flex-1 gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brands/gemini.png"
            alt=""
            title="Gemini"
            className="mt-0.5 h-7 w-7 shrink-0 object-contain"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              AI recommendation
            </p>
            <p className="mt-1 text-sm leading-snug text-[var(--muted)]">
              {plan.advisory}
            </p>
            {shortageDoc?.workflowStep ? (
              <p className="mt-1 text-[12px] text-[#2f5f9e]">
                Saved progress · step {shortageDoc.workflowStep} of 3
                {shortageDoc.workflowStep === 1
                  ? " (compare options)"
                  : shortageDoc.workflowStep === 2
                    ? " (review & approve)"
                    : " (track delivery)"}
              </p>
            ) : null}
          </div>
        </div>
        <Link
          href={
            shortageDoc?.workflowStep
              ? hrefForShortageWorkflow(
                  shortageId,
                  shortageDoc.workflowStep,
                )
              : plan.compareHref
          }
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#254d82]"
        >
          {shortageDoc?.workflowStep && shortageDoc.workflowStep >= 2
            ? "Continue where you left off"
            : "Compare allocation options"}
        </Link>
      </div>

      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
          View map (optional)
        </h2>
        <p className="mt-0.5 text-sm text-[var(--muted)]">
          See community locations and access conditions.
        </p>
        <p className="mt-0.5 text-[12px] text-[var(--muted)]">
          Illustrative areas · Field confirmation required.
        </p>
        <div className="mt-3">
          <ShortagePlanMap rows={plan.rows} />
        </div>
      </section>
    </div>
  );
}
