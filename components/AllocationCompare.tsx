"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import { AllocationPlanStepper } from "@/components/AllocationPlanStepper";
import { easeOut, useMotionSafe } from "@/components/motion/primitives";
import { scopeLabel } from "@/lib/reports/barangayScope";
import {
  getShortageById,
  saveSelectedAllocationOption,
  saveShortageAllocationDraft,
  saveShortageWorkflowStep,
  upsertShortageFromPlan,
} from "@/lib/resourcesShortages/api";
import {
  buildLocalAllocationOptions,
  type AllocationOption,
} from "@/lib/workspace/allocationOptions";
import {
  buildSupplyShortagePlan,
  reportsForEpicCode,
  type SupplyShortagePlan,
} from "@/lib/workspace/supplyShortagePlan";
import { cn } from "@/lib/utils";

const SHOW_GEMINI_DEBUG =
  process.env.NEXT_PUBLIC_USE_EMULATORS === "true" ||
  process.env.NODE_ENV !== "production";

const CACHE_PREFIX = "ugnai.allocationOptions.v1:";

type GeminiDebug = {
  prompt?: string | null;
  raw?: string | null;
  model?: string;
  error?: string;
};

type CachedAllocation = {
  options: AllocationOption[];
  source: "gemini" | "local";
  debug?: GeminiDebug | null;
  savedAt: string;
};

function cacheKey(planKey: string): string {
  return `${CACHE_PREFIX}${planKey}`;
}

function readAllocationCache(planKey: string): CachedAllocation | null {
  if (typeof window === "undefined" || !planKey) return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(planKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedAllocation;
    if (!Array.isArray(parsed.options) || parsed.options.length < 3) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeAllocationCache(planKey: string, value: CachedAllocation): void {
  if (typeof window === "undefined" || !planKey) return;
  try {
    sessionStorage.setItem(cacheKey(planKey), JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

function fmtL(n: number): string {
  return `${n.toLocaleString("en-PH")} L`;
}

function constraintTone(constraint: AllocationOption["lines"][number]["constraint"]) {
  if (constraint === "no_blockers") {
    return "text-[#16794c]";
  }
  if (constraint === "no_transport") {
    return "text-[#b91c1c]";
  }
  return "text-[#b45309]";
}

export function AllocationCompare() {
  const { profile } = useAuth();
  const { reports, scopedReports, reportScope } = useCommandWorkspace();
  const router = useRouter();
  const params = useParams();
  const motionOk = useMotionSafe();
  const rsCode = String(params.id ?? "RS-001").trim().toUpperCase() || "RS-001";

  const [selectedId, setSelectedId] = useState<string>("feasible");
  const [options, setOptions] = useState<AllocationOption[]>([]);
  const [geminiPending, setGeminiPending] = useState(false);
  const [source, setSource] = useState<"gemini" | "local" | null>(null);
  const [geminiDebug, setGeminiDebug] = useState<GeminiDebug | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const placeHint = useMemo(() => {
    if (isOfficer(profile)) {
      const b = profile.barangay?.trim();
      if (b) return b;
    }
    return scopeLabel(reportScope);
  }, [profile, reportScope]);

  const plan = useMemo((): SupplyShortagePlan | null => {
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
    if (!matched) {
      const water = reportsForEpicCode("RS-001", scopedReports);
      if (water) return buildSupplyShortagePlan(water.kind, water.reports);
      return null;
    }
    return buildSupplyShortagePlan(matched.kind, matched.reports);
  }, [reports, scopedReports, rsCode]);

  const planKey = useMemo(() => {
    if (!plan) return "";
    return [
      plan.code,
      plan.availableL,
      plan.totalNeededL,
      ...plan.rows.map(
        (r) => `${r.reportId}:${r.gapL}:${r.readiness}:${r.needL}`,
      ),
    ].join("|");
  }, [plan]);

  function applyOptions(
    next: AllocationOption[],
    nextSource: "gemini" | "local",
    debug?: GeminiDebug | null,
  ) {
    setOptions(next);
    setSource(nextSource);
    setGeminiDebug(debug ?? null);
    const suggested = next.find((o) => o.suggested) ?? next[0];
    if (suggested) setSelectedId(suggested.id);
  }

  async function persistDraft(
    next: AllocationOption[],
    nextSource: "gemini" | "local",
    debug?: GeminiDebug | null,
  ) {
    if (!plan || !planKey || next.length < 3) return;
    const savedAt = new Date().toISOString();
    const payload: CachedAllocation = {
      options: next,
      source: nextSource,
      debug: debug ?? null,
      savedAt,
    };
    writeAllocationCache(planKey, payload);
    try {
      await upsertShortageFromPlan(plan);
      await saveShortageAllocationDraft(plan.code, {
        planKey,
        options: next,
        source: nextSource,
        prompt: debug?.prompt ?? null,
        raw: debug?.raw ?? null,
        model: debug?.model ?? null,
        error: debug?.error ?? null,
        savedAt,
      });
    } catch {
      /* session cache still holds this visit */
    }
  }

  async function fetchGeminiOptions(force: boolean) {
    if (!plan || !planKey) return;

    if (!force) {
      const fromDb = await getShortageById(plan.code);
      if (
        fromDb?.allocation &&
        fromDb.allocation.planKey === planKey &&
        fromDb.allocation.options.length >= 3
      ) {
        const d = fromDb.allocation;
        const debug: GeminiDebug = {
          prompt: d.prompt,
          raw: d.raw,
          model: d.model ?? undefined,
          error: d.error ?? undefined,
        };
        applyOptions(d.options, d.source, SHOW_GEMINI_DEBUG ? debug : null);
        writeAllocationCache(planKey, {
          options: d.options,
          source: d.source,
          debug,
          savedAt: d.savedAt,
        });
        setGeminiPending(false);
        return;
      }
      const cached = readAllocationCache(planKey);
      if (cached) {
        applyOptions(cached.options, cached.source, cached.debug ?? null);
        setGeminiPending(false);
        return;
      }
    }

    setGeminiPending(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch("/api/ai/allocation-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          availableL: plan.availableL,
          totalNeededL: plan.totalNeededL,
          resourceLabel: plan.resourceLabel,
          rows: plan.rows,
        }),
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        options?: AllocationOption[];
        source?: "gemini" | "local";
        debug?: GeminiDebug;
      };
      const next = Array.isArray(data.options) ? data.options : [];
      const nextSource = data.source === "gemini" ? "gemini" : "local";
      const debug = data.debug ?? null;
      if (next.length >= 3) {
        applyOptions(next, nextSource, SHOW_GEMINI_DEBUG ? debug : null);
        await persistDraft(next, nextSource, debug);
      }
    } catch {
      /* keep whatever is on screen */
    } finally {
      window.clearTimeout(timeout);
      setGeminiPending(false);
    }
  }

  useEffect(() => {
    if (!plan || !planKey) {
      setOptions([]);
      setSource(null);
      setGeminiPending(false);
      setGeminiDebug(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      // 1) Firestore draft for this shortage id + plan fingerprint
      try {
        const fromDb = await getShortageById(plan.code);
        if (
          fromDb &&
          (fromDb.workflowStep == null || fromDb.workflowStep === 1)
        ) {
          void saveShortageWorkflowStep(plan.code, 1).catch(() => {
            /* offline */
          });
        }
        if (cancelled) return;
        if (
          fromDb?.allocation &&
          fromDb.allocation.planKey === planKey &&
          fromDb.allocation.options.length >= 3
        ) {
          const d = fromDb.allocation;
          const debug: GeminiDebug = {
            prompt: d.prompt,
            raw: d.raw,
            model: d.model ?? undefined,
            error: d.error ?? undefined,
          };
          applyOptions(d.options, d.source, SHOW_GEMINI_DEBUG ? debug : null);
          writeAllocationCache(planKey, {
            options: d.options,
            source: d.source,
            debug,
            savedAt: d.savedAt,
          });
          setGeminiPending(false);
          return;
        }
      } catch {
        /* fall through */
      }
      if (cancelled) return;

      // 2) session cache
      const cached = readAllocationCache(planKey);
      if (cached) {
        applyOptions(cached.options, cached.source, cached.debug ?? null);
        setGeminiPending(false);
        void persistDraft(
          cached.options,
          cached.source,
          cached.debug ?? null,
        );
        return;
      }

      // 3) First visit: local drafts, then one Gemini call (saved to RS-001).
      const local = buildLocalAllocationOptions(
        plan.rows,
        plan.availableL,
        plan.totalNeededL,
        plan.resourceLabel,
      );
      applyOptions(local.options, "local", null);
      void fetchGeminiOptions(true);
    })();

    return () => {
      cancelled = true;
    };
    // planKey is the stable fingerprint; plan is read inside fetch/persist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planKey]);

  if (!plan) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
        <p className="font-medium text-[var(--foreground)]">
          No shortage plan in scope
        </p>
        <Link
          href="/admin/resources"
          className="mt-4 inline-flex rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium"
        >
          Back to Resources
        </Link>
      </div>
    );
  }

  const selected = options.find((o) => o.id === selectedId) ?? options[0];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link
          href={`/admin/resources/${encodeURIComponent(plan.code)}`}
          className="text-[12px] font-medium text-[#2f5f9e] hover:underline"
        >
          ← Back to resources
        </Link>
        <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)] shadow-sm">
          {placeHint}
        </div>
      </div>

      <AllocationPlanStepper current={1} className="mt-4" />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
          Compare allocation options
        </h1>
        <span className="rounded-md bg-[#e2e8f0] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--muted)]">
          DRAFT
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
        Choose the best way to distribute the {fmtL(plan.availableL)} of
        available {plan.resourceLabel.toLowerCase()}.
      </p>

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

      <section className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Allocation options
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--muted)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brands/gemini.png"
                alt=""
                title="Gemini"
                className="h-3.5 w-auto shrink-0 opacity-90"
              />
              {geminiPending
                ? "Showing local drafts · Gemini refining…"
                : source === "gemini"
                  ? `Drafted with Gemini · saved on resources_shortages/${plan.code} (prompt + return reused).`
                  : "Local draft plans · confirm before committing."}
            </p>
          </div>
          <button
            type="button"
            disabled={geminiPending || !plan}
            onClick={() => void fetchGeminiOptions(true)}
            className="inline-flex rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-[12px] font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25 disabled:opacity-50"
          >
            {geminiPending ? "Calling Gemini…" : "Regenerate with Gemini"}
          </button>
        </div>

        {options.length === 0 ? (
          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl border border-[var(--border)] bg-[#f1f5f9]"
              />
            ))}
          </div>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {options.map((opt, index) => {
              const active = selected?.id === opt.id;
              const dragging = draggingId === opt.id;
              return (
                <motion.div
                  key={`${opt.id}-${index}`}
                  role="button"
                  tabIndex={0}
                  layout={motionOk}
                  drag={motionOk}
                  dragSnapToOrigin
                  dragElastic={0.35}
                  dragConstraints={{ top: -28, left: -36, right: 36, bottom: 28 }}
                  onDragStart={() => setDraggingId(opt.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setSelectedId(opt.id);
                  }}
                  onClick={() => setSelectedId(opt.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(opt.id);
                    }
                  }}
                  whileHover={
                    motionOk && !dragging
                      ? { y: -3, transition: { duration: 0.18, ease: easeOut } }
                      : undefined
                  }
                  whileTap={motionOk ? { scale: 0.985 } : undefined}
                  whileDrag={
                    motionOk
                      ? {
                          scale: 1.04,
                          rotate: 0.6,
                          zIndex: 30,
                          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.16)",
                        }
                      : undefined
                  }
                  animate={
                    motionOk
                      ? active
                        ? {
                            scale: dragging ? 1.04 : 1.015,
                            y: 0,
                          }
                        : {
                            scale: 1,
                            y: 0,
                          }
                      : undefined
                  }
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  className={cn(
                    "relative flex cursor-grab flex-col rounded-2xl border bg-white p-4 text-left shadow-sm active:cursor-grabbing",
                    active
                      ? "border-[#2f5f9e]"
                      : "border-[var(--border)]",
                    dragging && "z-30",
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId={motionOk ? "allocation-option-ring" : undefined}
                      className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-[#2f5f9e]/35"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  ) : null}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] font-medium tracking-wide text-[var(--muted)]">
                      Option {index + 1}
                    </p>
                    {opt.suggested || index === 0 ? (
                      <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] font-medium text-[#2f5f9e] ring-1 ring-[#bfdbfe]">
                        Suggested starting point
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                    {opt.title}
                  </p>
                  <p className="mt-1 text-[12px] text-[var(--muted)]">
                    {opt.blurb}
                  </p>
                  <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--border)]">
                    <table className="w-full min-w-[280px] text-left text-[12px]">
                      <thead>
                        <tr className="border-b border-[var(--border)] bg-[#f8fafc] text-[var(--muted)]">
                          <th className="px-2.5 py-1.5 font-medium">Sitio</th>
                          <th className="px-2.5 py-1.5 font-medium">Need</th>
                          <th className="px-2.5 py-1.5 font-medium">Get</th>
                          <th className="px-2.5 py-1.5 font-medium">
                            Constraint
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {opt.lines.map((line, lineIdx) => (
                          <tr
                            key={`${opt.id}-${line.reportId || line.community}-${lineIdx}`}
                            className="border-b border-[var(--border)] last:border-b-0"
                          >
                            <td className="px-2.5 py-1.5 font-medium text-[var(--foreground)]">
                              {line.community.replace(/^Sitio\s+/i, "")}
                            </td>
                            <td className="px-2.5 py-1.5 tabular-nums">
                              {fmtL(line.needL)}
                            </td>
                            <td className="px-2.5 py-1.5 tabular-nums font-semibold text-[#2f5f9e]">
                              {fmtL(line.allocateL)}
                            </td>
                            <td
                              className={cn(
                                "px-2.5 py-1.5 font-medium",
                                constraintTone(line.constraint),
                              )}
                            >
                              {line.constraintLabel}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 rounded-xl bg-[#f8fafc] px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/brands/gemini.png"
                        alt=""
                        title="Gemini"
                        className="h-3 w-auto shrink-0 opacity-90"
                      />
                      AI summary
                    </p>
                    <p className="mt-1 text-[12px] leading-snug text-[var(--foreground)]">
                      {opt.summary}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-[11px] text-[var(--muted)]">
          Fresh inventory and transport checks, plus human approval, are still
          required before any commitment is made.
        </p>
        <button
          type="button"
          disabled={!selected || options.length === 0}
          onClick={() => {
            if (!selected) return;
            void saveSelectedAllocationOption(plan.code, selected.id)
              .catch(() => {
                /* still navigate; review loads option from DB */
              })
              .finally(() => {
                router.push(
                  `/admin/resources/review/${encodeURIComponent(plan.code)}`,
                );
              });
          }}
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#254d82] disabled:opacity-50"
        >
          Continue to plan review
        </button>
      </div>

      {SHOW_GEMINI_DEBUG ? (
        <section className="mt-6 space-y-3 rounded-2xl border border-dashed border-[#93c5fd] bg-[#f8fafc] p-4">
          <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wide text-[#2f5f9e] uppercase">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brands/gemini.png"
              alt=""
              title="Gemini"
              className="h-4 w-auto shrink-0"
            />
            Local debug · Gemini prompt &amp; return
          </p>
          {geminiPending && !geminiDebug ? (
            <p className="text-[12px] text-[var(--muted)]">
              Waiting for Gemini…
            </p>
          ) : null}
          {geminiDebug?.error ? (
            <p className="text-[12px] text-[#b91c1c]">{geminiDebug.error}</p>
          ) : null}
          {geminiDebug?.model ? (
            <p className="text-[12px] text-[var(--muted)]">
              Model: {geminiDebug.model}
            </p>
          ) : null}
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--foreground)]">
              Prompt
            </span>
            <textarea
              readOnly
              value={geminiDebug?.prompt ?? ""}
              rows={12}
              className="mt-1 w-full resize-y rounded-xl border border-[var(--border)] bg-white p-3 font-mono text-[11px] leading-relaxed text-[var(--foreground)]"
            />
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-[var(--foreground)]">
              Gemini return
            </span>
            <textarea
              readOnly
              value={geminiDebug?.raw ?? ""}
              rows={14}
              className="mt-1 w-full resize-y rounded-xl border border-[var(--border)] bg-white p-3 font-mono text-[11px] leading-relaxed text-[var(--foreground)]"
            />
          </label>
        </section>
      ) : null}
    </div>
  );
}
