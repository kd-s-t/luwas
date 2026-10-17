"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Package } from "lucide-react";
import { FadeIn } from "@/components/motion/primitives";
import { ResourceShortagePlan } from "@/components/ResourceShortagePlan";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import { scopeLabel } from "@/lib/reports/barangayScope";
import {
  clearAssistanceCommitment,
  listAssistanceCommitments,
  type AssistanceCommitment,
} from "@/lib/workspace/assistanceCommitments";
import {
  buildResourceBoard,
  type ResourceActivityStatus,
  type ResourceNeed,
} from "@/lib/workspace/resourceBoard";
import { listenAllSuggestions } from "@/lib/resourcesSuggestions/api";
import type { ResourceSuggestion } from "@/lib/resourcesSuggestions/types";
import {
  buildSupplyShortagePlan,
  reportsForEpicCode,
} from "@/lib/workspace/supplyShortagePlan";
import { cn } from "@/lib/utils";

const RESERVED_RESOURCE_SEGMENTS = new Set([
  "compare",
  "review",
  "suggestions",
  "assist",
]);

function fmtSuggestionL(n: number): string {
  return `${n.toLocaleString("en-PH")} L`;
}

function formatPlaceLine(date: Date, place: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${place} · ${day} ${month} ${year} · Philippine Standard Time (PHT)`;
}

function statusTone(status: ResourceActivityStatus) {
  if (status === "followup") {
    return "bg-[#fff7ed] text-[#c2410c] ring-[#fdba74]/70";
  }
  if (status === "pending") {
    return "bg-[#3b6fb6]/10 text-[#2f5f9e] ring-[#3b6fb6]/20";
  }
  if (status === "completed") {
    return "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60";
  }
  return "bg-[#fce7f3] text-[#9d174d] ring-[#f9a8d4]/50";
}

function NeedCard({ need }: { need: ResourceNeed }) {
  const shortage = need.kind === "shortage";
  const shared = Boolean(need.shared || need.affectsLabel);

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 shadow-sm sm:p-5",
        shared
          ? "border-[#fde68a] bg-[#fffbeb]"
          : shortage
            ? "border-[#fecaca] bg-[#fff7f7]"
            : "border-[#bfdbfe] bg-[#f8fbff]",
      )}
    >
      <div className={cn(shared && "flex gap-3")}>
        {shared ? (
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f59e0b]/12 text-[#d97706]">
            <Package className="size-5" aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1",
                  shared || shortage
                    ? "bg-[#f59e0b]/12 text-[#b45309] ring-[#f59e0b]/25"
                    : "bg-[#3b6fb6]/10 text-[#2f5f9e] ring-[#3b6fb6]/20",
                )}
              >
                {shared
                  ? "Shared resource shortage"
                  : shortage
                    ? "Shortage"
                    : "Approval needed"}
              </span>
              <span className="font-mono text-[11px] tracking-wide text-[var(--muted)]">
                {need.incidentCode}
              </span>
            </div>
            {shared && (need.timeLabel || need.requestMeta) ? (
              <div className="shrink-0 text-right text-[11px] leading-relaxed text-[var(--muted)]">
                {need.timeLabel ? <p>{need.timeLabel}</p> : null}
                {need.requestMeta ? <p>{need.requestMeta}</p> : null}
              </div>
            ) : null}
          </div>
          <h3 className="mt-2 text-base font-semibold tracking-tight text-[var(--foreground)]">
            {need.place}
          </h3>
          <p className="mt-1 text-sm leading-snug text-[var(--muted)]">
            {need.detail}
          </p>
          {need.affectsLabel ? (
            <p className="mt-1 text-sm leading-snug text-[var(--muted)]">
              {need.affectsLabel}
            </p>
          ) : null}
          {!shared && (need.householdsLabel || need.neededLabel) ? (
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-[var(--muted)]">
              {need.householdsLabel ? (
                <p>
                  <span className="font-medium text-[var(--foreground)]">
                    {need.householdsLabel}
                  </span>
                </p>
              ) : null}
              {need.neededLabel ? (
                <p>
                  <span className="font-medium text-[var(--foreground)]">
                    {need.neededLabel}
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 flex justify-end">
            <Link
              href={need.ctaHref}
              className={cn(
                "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition",
                need.primaryCta
                  ? "bg-[#c72929] text-white hover:bg-[#9e1a1a]"
                  : "border border-[#93c5fd] bg-white text-[#2f5f9e] hover:border-[#3b6fb6] hover:bg-[#f8fbff]",
              )}
            >
              {need.ctaLabel}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export function CommandResources() {
  const { profile } = useAuth();
  const { reports, scopedReports, activeOfficers, reportScope, seedReady } =
    useCommandWorkspace();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const paramId = String(params.id ?? "").trim().toUpperCase();
  const queryRs = searchParams.get("rs")?.trim().toUpperCase() ?? "";
  const rsCode =
    paramId && !RESERVED_RESOURCE_SEGMENTS.has(paramId.toLowerCase())
      ? paramId
      : "";
  const [query, setQuery] = useState("");
  const [commitments, setCommitments] = useState<AssistanceCommitment[]>([]);
  const [suggestions, setSuggestions] = useState<ResourceSuggestion[]>([]);

  function refreshCommitments() {
    setCommitments(listAssistanceCommitments());
  }

  useEffect(() => {
    refreshCommitments();
    const onFocus = () => refreshCommitments();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onFocus);
    };
  }, []);

  useEffect(() => listenAllSuggestions(setSuggestions), []);

  // Legacy ?rs=RS-001 → /admin/resources/RS-001
  useEffect(() => {
    if (!queryRs || rsCode) return;
    router.replace(`/admin/resources/${encodeURIComponent(queryRs)}`);
  }, [queryRs, rsCode, router]);

  const board = useMemo(
    () =>
      buildResourceBoard(
        scopedReports,
        activeOfficers.length,
        commitments,
      ),
    [scopedReports, activeOfficers.length, commitments],
  );

  const lastCommitment = commitments[0] ?? null;

  const placeHint = useMemo(() => {
    if (isOfficer(profile)) {
      const purok = profile.barangay?.trim();
      if (purok) return purok;
    }
    return scopeLabel(reportScope);
  }, [profile, reportScope]);

  const placeLine = useMemo(
    () => formatPlaceLine(new Date(), placeHint),
    [placeHint],
  );

  const apasDesk = useMemo(() => {
    if (isOfficer(profile)) {
      if (
        profile.activeBarangayId === "cebu-city/apas" ||
        profile.areaId === "cebu-city/apas" ||
        /apas/i.test(profile.barangay ?? "") ||
        /apas/i.test(profile.orgName ?? "")
      ) {
        return true;
      }
    }
    if (/apas/i.test(reportScope.mode === "barangay" ? reportScope.barangay : "")) {
      return true;
    }
    return scopedReports.some((r) => /apas/i.test(r.barangay ?? ""));
  }, [profile, scopedReports, reportScope]);

  const [sitioSeedTick, setSitioSeedTick] = useState(0);

  const shortagePlan = useMemo(() => {
    if (!rsCode) return null;
    // Prefer Apas Sitio* water demos (5 sitios) over Nangka Purok seeds.
    const apasWater = reports.filter(
      (r) =>
        r.status !== "rejected" &&
        r.status !== "done" &&
        /apas/i.test(r.barangay ?? "") &&
        /^Sitio\b/i.test(r.citizenPurok ?? "") &&
        /drinking\s+water|Need\s+\d+\s*L/i.test(
          `${r.title ?? ""}\n${r.notes ?? ""}`,
        ) &&
        !/food\s+packs/i.test(`${r.title ?? ""}\n${r.notes ?? ""}`),
    );
    if (apasWater.length >= 2) {
      return buildSupplyShortagePlan("water", apasWater);
    }
    const matched = reportsForEpicCode(rsCode, scopedReports);
    const water = reportsForEpicCode("RS-001", scopedReports);
    if (water && water.reports.length >= 2 && rsCode !== "RS-001") {
      return buildSupplyShortagePlan(water.kind, water.reports);
    }
    if (!matched) {
      if (water) return buildSupplyShortagePlan(water.kind, water.reports);
      return null;
    }
    return buildSupplyShortagePlan(matched.kind, matched.reports);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rsCode, scopedReports, reports, sitioSeedTick]);

  useEffect(() => {
    if (!shortagePlan) return;
    if (shortagePlan.code === "RS-001" && rsCode !== "RS-001") {
      router.replace("/admin/resources/RS-001");
    }
  }, [shortagePlan, rsCode, router]);

  // Always seed Apas Sitio water demos for the shortage desk.
  useEffect(() => {
    if (!isOfficer(profile) || !profile) return;
    let cancelled = false;
    void (async () => {
      try {
        const { ensureApasWaterAndFireReports } = await import(
          "@/lib/onboarding/apasSeed"
        );
        await ensureApasWaterAndFireReports();
        if (!cancelled) setSitioSeedTick((n) => n + 1);
      } catch (err) {
        if (!cancelled) console.warn("Apas sitio water seed failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, rsCode]);

  const updatedLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      }).format(new Date());
    } catch {
      return "—";
    }
  }, []);

  const filteredNeeds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return board.needs;
    return board.needs.filter(
      (n) =>
        n.place.toLowerCase().includes(q) ||
        n.incidentCode.toLowerCase().includes(q) ||
        n.detail.toLowerCase().includes(q),
    );
  }, [board.needs, query]);

  if (rsCode) {
    if (shortagePlan) {
      return (
        <ResourceShortagePlan
          plan={shortagePlan}
          placeLine={placeHint}
          updatedLabel={updatedLabel}
        />
      );
    }
    // Brief wait for first report snapshot only — seedReady is not a gate.
    if (scopedReports.length === 0 && !seedReady) {
      return (
        <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <p className="text-sm text-[var(--muted)]">Loading shortage plan…</p>
        </div>
      );
    }
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 text-center">
        <p className="font-medium text-[var(--foreground)]">
          Shortage plan not in scope
        </p>
        <p className="mt-1 max-w-md text-sm text-[var(--muted)]">
          No open {rsCode} supply requests match this workspace yet.
        </p>
        <Link
          href="/admin/resources"
          className="mt-4 inline-flex rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)]"
        >
          Back to Resources
        </Link>
      </div>
    );
  }

  const summary = [
    {
      value: board.shortageCommunities,
      label: "Communities with shortages",
      tone: "bg-[#c72929]/10 text-[#c72929]",
    },
    {
      value: board.plansAwaiting,
      label: "Plans awaiting approval",
      tone: "bg-[#3b6fb6]/10 text-[#3b6fb6]",
    },
    {
      value: board.partnerOffersAwaiting,
      label: "Partner offers awaiting approval",
      tone: "bg-[#16794c]/10 text-[#16794c]",
    },
    {
      value: board.respondersAvailable,
      label: "Local responders available",
      tone: "bg-[#7c3aed]/10 text-[#7c3aed]",
    },
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <FadeIn y={8} className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
              Resources
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              Manage local and external resources to support affected
              communities. {placeLine}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/resources/suggestions"
              className="inline-flex items-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-sm transition hover:border-[var(--foreground)]/25"
            >
              View all resources suggested →
            </Link>
            <Link
              href="/admin/inventory"
              className="inline-flex items-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] shadow-sm transition hover:border-[var(--foreground)]/25"
            >
              View inventory →
            </Link>
          </div>
        </div>
      </FadeIn>

      <div className="mt-4 grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((card, i) => (
          <FadeIn key={card.label} delay={0.04 + i * 0.03} y={8}>
            <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3.5 shadow-sm">
              <p
                className={cn(
                  "inline-flex rounded-lg px-2 py-0.5 font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums tracking-wide",
                  card.tone,
                )}
              >
                {card.value}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{card.label}</p>
            </div>
          </FadeIn>
        ))}
      </div>

      <div className="mt-4 grid shrink-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)]">
        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
                Communities needing assistance
              </h2>
              <span className="rounded-full bg-[var(--foreground)]/6 px-2 py-0.5 text-[11px] font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
                {filteredNeeds.length}{" "}
                {filteredNeeds.length === 1 ? "need" : "needs"}
              </span>
            </div>
            <label className="sr-only" htmlFor="resource-search">
              Search by barangay or incident
            </label>
            <input
              id="resource-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by barangay or incident #"
              className="w-full max-w-xs rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] shadow-sm outline-none placeholder:text-[var(--muted)] focus:border-[#3b6fb6]/50"
            />
          </div>
          <div className="space-y-3">
            {filteredNeeds.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/70 px-5 py-10 text-center">
                <p className="font-medium text-[var(--foreground)]">
                  No open resource needs
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {lastCommitment
                    ? `${lastCommitment.incidentCode} was approved, so its shortage card (with Find assistance) is off the board.`
                    : "Shortage cards with Find assistance appear here when stock cannot cover a need."}
                </p>
                {lastCommitment ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearAssistanceCommitment(lastCommitment.reportId);
                      refreshCommitments();
                    }}
                    className="mt-4 inline-flex rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
                  >
                    Reopen {lastCommitment.incidentCode}
                  </button>
                ) : null}
              </div>
            ) : (
              filteredNeeds.map((need) => (
                <NeedCard key={need.id} need={need} />
              ))
            )}
          </div>

          {board.aiAdvisory ? (
            <div className="mt-4 rounded-2xl border border-[#93c5fd]/60 bg-[#eff6ff] px-4 py-3.5 sm:px-5">
              <p className="text-[11px] font-medium tracking-wide text-[#2f5f9e] uppercase">
                AI Resource Scarcity Intelligence
              </p>
              <p className="mt-1 text-sm text-[var(--foreground)]">
                <span className="font-medium text-[#2f5f9e]">
                  Advisory only · Human approval required.
                </span>{" "}
                {board.aiAdvisory}
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <Link
                  href="/admin/incidents"
                  className="text-sm font-medium text-[#2f5f9e] hover:underline"
                >
                  Why this recommendation →
                </Link>
                <Link
                  href="/admin/resources/suggestions"
                  className="text-sm font-medium text-[#2f5f9e] hover:underline"
                >
                  View all resources suggested →
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex justify-end">
              <Link
                href="/admin/resources/suggestions"
                className="text-sm font-medium text-[#2f5f9e] hover:underline"
              >
                View all resources suggested →
              </Link>
            </div>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-4">
          <section
            id="inventory"
            className="scroll-mt-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5"
          >
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Local resource availability
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {board.localStock.map((cell) => (
                <div
                  key={cell.id}
                  className="rounded-xl border border-[var(--border)] bg-[#f8fafc] px-3 py-3"
                >
                  <p className="text-[11px] text-[var(--muted)]">{cell.label}</p>
                  <p
                    className={cn(
                      "mt-1 text-sm font-semibold",
                      cell.ok ? "text-[#16794c]" : "text-[#c72929]",
                    )}
                  >
                    {cell.available} available
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-snug text-[var(--muted)]">
              Last checked {board.lastCheckLabel} · Recheck before allocation.{" "}
              {board.waterLiters} L water available · Assigned stock excluded.
            </p>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Resources suggested
            </h2>
            <p className="mt-1 text-[12px] text-[var(--muted)]">
              {suggestions.length}{" "}
              {suggestions.length === 1 ? "plan" : "plans"}
            </p>
            <Link
              href="/admin/resources/suggestions"
              className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[#2f5f9e] shadow-sm transition hover:border-[#2f5f9e]/40"
            >
              View all resources suggested →
            </Link>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                Partner requests
              </h2>
              {board.partnerOffersAwaiting > 0 ? (
                <span className="text-[11px] font-medium text-[var(--muted)]">
                  {board.partnerOffersAwaiting} awaiting approval
                </span>
              ) : (
                <Link
                  href="/admin/partners"
                  className="text-[12px] font-medium text-[#2f5f9e] hover:underline"
                >
                  Manage partners →
                </Link>
              )}
            </div>
            <div className="mt-3 space-y-3">
              {board.partnerOffers.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  No partner offers awaiting approval.
                </p>
              ) : (
                board.partnerOffers.map((offer) => (
                  <div
                    key={offer.id}
                    className="rounded-xl border border-[var(--border)] bg-[#f8fafc] px-3.5 py-3"
                  >
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {offer.partner}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[var(--muted)]">
                      {offer.title}
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--muted)]">
                      {offer.detail}
                    </p>
                    <Link
                      href={offer.href}
                      className="mt-3 inline-flex rounded-xl border border-[#93c5fd] bg-white px-3 py-2 text-sm font-medium text-[#2f5f9e] transition hover:border-[#3b6fb6]"
                    >
                      Review request
                    </Link>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
              Resources suggested
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">
              {suggestions.length}{" "}
              {suggestions.length === 1 ? "plan" : "plans"}
            </p>
          </div>
          <Link
            href="/admin/resources/suggestions"
            className="text-sm font-medium text-[#2f5f9e] hover:underline"
          >
            View all resources suggested →
          </Link>
        </div>
        <div className="overflow-x-auto border-t border-[var(--border)]">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] tracking-wide text-[var(--muted)] uppercase">
                <th className="px-4 py-2.5 font-medium sm:px-5">Plan</th>
                <th className="px-4 py-2.5 font-medium">Requests</th>
                <th className="px-4 py-2.5 font-medium">Need</th>
                <th className="px-4 py-2.5 font-medium">Gap</th>
                <th className="px-4 py-2.5 font-medium sm:px-5">Action</th>
              </tr>
            </thead>
            <tbody>
              {suggestions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[var(--muted)] sm:px-5"
                  >
                    No suggestions yet. Review a shortage to save a plan.
                  </td>
                </tr>
              ) : (
                suggestions.slice(0, 5).map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--border)]/70 last:border-0"
                  >
                    <td className="px-4 py-3 sm:px-5">
                      <Link
                        href={`/admin/resources/${encodeURIComponent(row.id)}`}
                        className="font-medium text-[#2f5f9e] hover:underline"
                      >
                        {row.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {row.requestCount || row.requests.length} sitios
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {fmtSuggestionL(row.totalNeededL)}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-[#c72929]">
                      {fmtSuggestionL(row.shortageL)}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <Link
                        href={`/admin/resources/${encodeURIComponent(row.id)}`}
                        className="inline-flex rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
                      >
                        Open plan
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-4 mb-2 overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
            Recent resource activity
          </h2>
          <Link
            href="/admin/activity"
            className="text-sm font-medium text-[#2f5f9e] hover:underline"
          >
            View all activity →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-[11px] tracking-wide text-[var(--muted)] uppercase">
                <th className="px-4 py-2.5 font-medium sm:px-5">Time</th>
                <th className="px-4 py-2.5 font-medium">Community / Incident</th>
                <th className="px-4 py-2.5 font-medium">Details</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium sm:px-5">Action</th>
              </tr>
            </thead>
            <tbody>
              {board.activity.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-[var(--muted)] sm:px-5"
                  >
                    No resource activity yet.
                  </td>
                </tr>
              ) : (
                board.activity.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--border)]/70 last:border-0"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-[var(--muted)] sm:px-5">
                      {row.timeLabel}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--foreground)]">
                        {row.community}
                      </p>
                      <p className="font-mono text-[11px] text-[var(--muted)]">
                        {row.incidentCode}
                      </p>
                    </td>
                    <td className="max-w-[18rem] px-4 py-3 text-[var(--muted)]">
                      <p className="line-clamp-2">{row.detail}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                          statusTone(row.status),
                        )}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap sm:px-5">
                      <Link
                        href={row.actionHref}
                        className="inline-flex rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
                      >
                        {row.actionLabel}
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
