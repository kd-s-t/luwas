"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import {
  getShortageById,
  saveShortageWorkflowStep,
} from "@/lib/resourcesShortages/api";
import type { ResourceShortage } from "@/lib/resourcesShortages/types";
import type { AllocationLine } from "@/lib/workspace/allocationOptions";
import {
  buildSupplyShortagePlan,
  reportsForEpicCode,
} from "@/lib/workspace/supplyShortagePlan";
import { cn } from "@/lib/utils";

type VehicleOption = {
  id: string;
  name: string;
  ownerLine: string;
  capacityL: number;
  distanceKm: number;
  etaMin: number;
  status: "available" | "later";
  statusLabel: string;
  note: string;
  imageUrl: string;
};

const VEHICLES: VehicleOption[] = [
  {
    id: "lgu-water-01",
    name: "LGU Water Truck 01",
    ownerLine: "LGU fleet · Candidate only; availability must be checked",
    capacityL: 2000,
    distanceKm: 8,
    etaMin: 18,
    status: "available",
    statusLabel: "Available",
    note: "",
    imageUrl: "/inventory/inventory-multicab.jpg",
  },
  {
    id: "partner-truck-01",
    name: "Partner Truck (NGO)",
    ownerLine: "Partner · Red Cross · Confirm before commit",
    capacityL: 1500,
    distanceKm: 12,
    etaMin: 28,
    status: "available",
    statusLabel: "Available",
    note: "",
    imageUrl: "/inventory/inventory-multicab.jpg",
  },
  {
    id: "lgu-pickup",
    name: "LGU Pickup (500 L tank)",
    ownerLine: "LGU fleet · Hall garage",
    capacityL: 500,
    distanceKm: 6,
    etaMin: 14,
    status: "available",
    statusLabel: "Available",
    note: "2 trips needed for 800 L",
    imageUrl: "/inventory/inventory-multicab.jpg",
  },
  {
    id: "partner-truck-02",
    name: "Partner Truck 02",
    ownerLine: "Partner · civic group",
    capacityL: 1000,
    distanceKm: 10,
    etaMin: 35,
    status: "later",
    statusLabel: "Available later",
    note: "Sep 26, 2026",
    imageUrl: "/inventory/inventory-multicab.jpg",
  },
];

const FILTERS = [
  { label: "Vehicle type", value: "All types" },
  { label: "Availability", value: "All availability" },
  { label: "Capacity", value: "All capacities" },
  { label: "Distance / sort", value: "Recommended first" },
] as const;

function fmtL(n: number): string {
  return `${n.toLocaleString("en-PH")} L`;
}

function defaultDateLabel(): string {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).format(new Date());
}

export function ResolveTransportConstraint() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { reports, scopedReports } = useCommandWorkspace();

  const rsCode =
    String(params.id ?? "RS-001").trim().toUpperCase() || "RS-001";
  const reportParam = (searchParams.get("report") ?? "").trim();

  const [shortage, setShortage] = useState<ResourceShortage | null>(null);
  const [vehicleId, setVehicleId] = useState(VEHICLES[0]!.id);
  const [qtyL, setQtyL] = useState(0);
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const doc = await getShortageById(rsCode);
      if (cancelled) return;
      setShortage(doc);
      if (doc?.reviewStatus === "approved" || doc?.workflowStep === 3) {
        try {
          await saveShortageWorkflowStep(rsCode, 3);
        } catch {
          /* offline */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rsCode]);

  const lines = useMemo((): AllocationLine[] => {
    const options = shortage?.allocation?.options ?? [];
    const id = shortage?.selectedOptionId || options[0]?.id || "";
    const opt = options.find((o) => o.id === id) ?? options[0];
    return opt?.lines ?? [];
  }, [shortage]);

  const focusLine = useMemo(() => {
    const transport = lines.filter((l) => l.constraint === "no_transport");
    if (reportParam) {
      const match = lines.find((l) => l.reportId === reportParam);
      if (match) return match;
    }
    return transport[0] ?? lines[0] ?? null;
  }, [lines, reportParam]);

  const planMeta = useMemo(() => {
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
    if (matched) return buildSupplyShortagePlan(matched.kind, matched.reports);
    const water = reportsForEpicCode("RS-001", scopedReports);
    if (water) return buildSupplyShortagePlan(water.kind, water.reports);
    return null;
  }, [reports, scopedReports, rsCode]);

  useEffect(() => {
    if (!focusLine) return;
    const qty = focusLine.needL || focusLine.allocateL;
    setQtyL(qty);
    setNotes(
      `Please deliver ${fmtL(qty)} of drinking water to ${focusLine.community}.`,
    );
    setAdded(false);
  }, [
    focusLine?.reportId,
    focusLine?.allocateL,
    focusLine?.needL,
    focusLine?.community,
  ]);

  const selected = VEHICLES.find((v) => v.id === vehicleId) ?? VEHICLES[0]!;
  const needL = focusLine?.needL || focusLine?.allocateL || 0;
  const availableL = shortage?.availableL ?? planMeta?.availableL ?? 0;
  const totalProposed = lines.reduce(
    (s, l) => s + Math.max(0, l.allocateL),
    0,
  );
  const unplannedPool = Math.max(0, availableL - totalProposed);
  const budgetForThis = unplannedPool + (focusLine?.allocateL ?? 0);
  const shortfallL = Math.max(0, qtyL - budgetForThis);
  const canAdd =
    shortfallL === 0 && qtyL > 0 && selected.status === "available";

  const reviewHref = `/admin/resources/review/${encodeURIComponent(rsCode)}`;
  const trackHref = `/admin/resources/track/${encodeURIComponent(rsCode)}`;
  const resourceLabel =
    shortage?.resourceLabel ?? planMeta?.resourceLabel ?? "Drinking water";
  const community = focusLine?.community ?? "Selected community";
  const optionTitle =
    shortage?.allocation?.options.find(
      (o) => o.id === (shortage.selectedOptionId || ""),
    )?.title ??
    shortage?.allocation?.options[0]?.title ??
    "Selected option";

  if (!focusLine && shortage === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
        <p className="font-medium text-[var(--foreground)]">
          Loading delivery track…
        </p>
      </div>
    );
  }

  if (!focusLine) {
    return (
      <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <Link
          href={trackHref}
          className="text-sm font-medium text-[#2f5f9e] hover:underline"
        >
          ← Back to track assistance
        </Link>
        <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[#2f5f9e]">
          Resolve transport constraint
        </h1>
        <p className="mt-2 max-w-lg text-sm text-[var(--muted)]">
          No transport constraints on the approved plan.
        </p>
        <Link
          href={trackHref}
          className="mt-4 inline-flex w-fit rounded-lg bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white"
        >
          Back to track assistance
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link
          href={trackHref}
          className="text-sm font-medium text-[#2f5f9e] hover:underline"
        >
          ← Back to track assistance
        </Link>
        <Link
          href={reviewHref}
          className="text-sm text-[var(--muted)] hover:text-[#2f5f9e] hover:underline"
        >
          Review & approve plan
        </Link>
      </div>

      <div className="mt-4 border-b border-[#bfdbfe] pb-3">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[#2f5f9e] sm:text-[1.85rem]">
          Resolve transport constraint
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {community} · {resourceLabel}
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.78fr)] lg:items-start">
        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border border-[#fecaca] bg-[#fff5f5] px-4 py-3.5 text-sm leading-relaxed text-[var(--foreground)]">
            <p>
              <span className="font-semibold text-[#b91c1c]">
                {community} has no confirmed transport.
              </span>{" "}
              {fmtL(needL)} is needed, but no vehicle is currently confirmed.
              Find a transport option, schedule a later delivery, or request
              partner support.
            </p>
          </div>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide text-[var(--foreground)]">
                Find available transport
              </h2>
              <p className="text-[12px] font-medium text-[var(--muted)]">
                {VEHICLES.length} vehicles found
              </p>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-snug text-[var(--muted)]">
              Check available LGU vehicles or partner assets for {community}.
              Compare capacity, distance and reported availability before
              proposing a delivery.
            </p>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {FILTERS.map((f) => (
                <label
                  key={f.label}
                  className="block text-[11px] font-medium text-[var(--muted)]"
                >
                  {f.label}
                  <select
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-sm text-[var(--foreground)]"
                    defaultValue={f.value}
                  >
                    <option>{f.value}</option>
                  </select>
                </label>
              ))}
            </div>

            <ul className="mt-4 space-y-2.5">
              {VEHICLES.map((v) => {
                const active = v.id === selected.id;
                return (
                  <li key={v.id}>
                    <div
                      className={cn(
                        "flex gap-3 rounded-xl border bg-white p-3 transition sm:gap-4 sm:p-3.5",
                        active
                          ? "border-[#3b6fb6] ring-1 ring-[#93c5fd]/70"
                          : "border-[var(--border)] hover:border-[var(--foreground)]/20",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setVehicleId(v.id)}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left sm:gap-3.5"
                        aria-pressed={active}
                      >
                        <span
                          className={cn(
                            "mt-3 flex size-[18px] shrink-0 items-center justify-center rounded-full border-2",
                            active
                              ? "border-[#2f5f9e]"
                              : "border-[#cbd5e1] bg-white",
                          )}
                          aria-hidden
                        >
                          {active ? (
                            <span className="size-2.5 rounded-full bg-[#2f5f9e]" />
                          ) : null}
                        </span>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={v.imageUrl}
                          alt=""
                          className="size-[4.25rem] shrink-0 rounded-lg object-cover ring-1 ring-[var(--border)] sm:size-[4.75rem]"
                        />
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[var(--foreground)]">
                              {v.name}
                            </p>
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1",
                                v.status === "available"
                                  ? "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60"
                                  : "bg-[#fffbeb] text-[#b45309] ring-[#fde68a]",
                              )}
                            >
                              {v.statusLabel}
                              {v.status === "later" && v.note
                                ? ` · ${v.note}`
                                : ""}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] leading-snug text-[var(--muted)]">
                            {fmtL(v.capacityL)} capacity · {v.distanceKm} km
                            away
                            {v.status === "available" && v.note
                              ? ` · ${v.note}`
                              : ""}
                          </p>
                          <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)]">
                            {v.ownerLine}
                          </p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setVehicleId(v.id)}
                        className="mt-1 shrink-0 self-start rounded-lg border border-[#93c5fd] bg-white px-3 py-1.5 text-[12px] font-medium text-[#2f5f9e] transition hover:border-[#3b6fb6]"
                      >
                        View details
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="rounded-xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3.5 text-sm leading-relaxed text-[var(--foreground)]">
            <p className="font-semibold text-[#2f5f9e]">What happens next?</p>
            <p className="mt-1 text-[var(--foreground)]/90">
              After water-budget and vehicle-availability checks, add a delivery
              proposal to the plan. Review the updated plan and obtain human
              approval later.{" "}
              <span className="font-medium">
                Selecting transport alone does not reserve water or a vehicle,
                or resolve the constraint.
              </span>
            </p>
          </div>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4">
          <div className="rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3.5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[12px] text-[#2f5f9e]/80">
                  Need for {community}
                </p>
                <p className="mt-0.5 font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums tracking-wide text-[#2f5f9e]">
                  {fmtL(needL)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[12px] text-[var(--muted)]">
                  Proposed allocation
                </p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--foreground)]">
                  {fmtL(focusLine.allocateL)}
                </p>
                <p className="text-[11px] text-[var(--muted)]">
                  In current plan ({optionTitle})
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
            <div className="relative h-40 bg-[linear-gradient(165deg,#c7d9f0_0%,#e8eef6_42%,#d4dde8_100%)]">
              <svg
                viewBox="0 0 320 160"
                className="absolute inset-0 h-full w-full"
                aria-hidden
              >
                <path
                  d="M36 118 C 90 108, 120 72, 168 64 C 210 58, 240 78, 286 52"
                  fill="none"
                  stroke="#2f5f9e"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <circle cx="36" cy="118" r="6" fill="#2f5f9e" />
                <circle cx="286" cy="52" r="6" fill="#2f5f9e" />
              </svg>
              <span className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-medium text-[#2f5f9e] shadow-sm">
                LGU depot
              </span>
              <span className="absolute top-3 right-3 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-medium text-[#2f5f9e] shadow-sm">
                {community}
              </span>
            </div>
            <p className="border-t border-[var(--border)] px-3.5 py-2 text-center text-[12px] text-[var(--muted)]">
              {selected.distanceKm} km · {selected.etaMin} min
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                Delivery details
              </h2>
              <span className="rounded-md bg-[#e2e8f0] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Request draft
              </span>
            </div>

            <label className="mt-4 block text-[12px] font-medium text-[var(--muted)]">
              Quantity to deliver
              <input
                type="text"
                value={`${fmtL(qtyL)} requested`}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/[^\d]/g, ""));
                  setQtyL(Number.isFinite(n) ? n : 0);
                }}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm tabular-nums text-[var(--foreground)]"
              />
            </label>

            <label className="mt-3 block text-[12px] font-medium text-[var(--muted)]">
              Delivery date
              <input
                type="text"
                readOnly
                value={defaultDateLabel()}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[#f8fafc] px-3 py-2.5 text-sm text-[var(--foreground)]"
              />
            </label>

            <div className="mt-3 space-y-1.5 text-[12px]">
              <p className="flex flex-wrap justify-between gap-2">
                <span className="text-[var(--muted)]">Vehicle capacity</span>
                <span className="font-medium tabular-nums text-[var(--foreground)]">
                  {fmtL(selected.capacityL)}
                </span>
              </p>
              <p className="flex flex-wrap justify-between gap-2">
                <span className="text-[var(--muted)]">
                  Available water budget
                </span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    shortfallL > 0 || unplannedPool === 0
                      ? "text-[#b91c1c]"
                      : "text-[#16794c]",
                  )}
                >
                  {fmtL(unplannedPool)} unplanned
                </span>
              </p>
            </div>

            {shortfallL > 0 ? (
              <div className="mt-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3.5 py-3 text-[12px] leading-snug text-[var(--foreground)]">
                <p>
                  <span className="font-semibold text-[#b45309]">
                    {fmtL(unplannedPool)} unplanned — allocation change
                    required.
                  </span>{" "}
                  Reallocate {fmtL(qtyL)} from existing proposals or confirm
                  extra supply before adding this request.
                </p>
                <button
                  type="button"
                  onClick={() => router.push(reviewHref)}
                  className="mt-2 font-semibold text-[#2f5f9e] underline-offset-2 hover:underline"
                >
                  Back to allocation plan
                </button>
              </div>
            ) : null}

            <label className="mt-3 block text-[12px] font-medium text-[var(--muted)]">
              Notes (optional)
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full resize-y rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm leading-snug text-[var(--foreground)]"
              />
            </label>

            <button
              type="button"
              disabled={!canAdd || added}
              onClick={() => {
                setAdded(true);
                router.back();
              }}
              className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--foreground)]/90 disabled:cursor-not-allowed disabled:bg-[#94a3b8] disabled:opacity-100"
            >
              {added ? "Added to plan" : "Add to plan"}
            </button>
            <button
              type="button"
              onClick={() => router.push(reviewHref)}
              className="mt-2.5 w-full text-center text-sm font-medium text-[#2f5f9e] hover:underline"
            >
              Cancel
            </button>
            {!canAdd && !added ? (
              <p className="mt-3 text-[11px] leading-snug text-[var(--muted)]">
                Add to plan stays disabled until water budget and vehicle
                availability checks pass.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
