"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AllocationPlanStepper } from "@/components/AllocationPlanStepper";
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
  owner: string;
  capacityL: number;
  distanceKm: number;
  etaMin: number;
  status: "available" | "later";
  statusLabel: string;
};

const VEHICLES: VehicleOption[] = [
  {
    id: "lgu-water-01",
    name: "LGU Water Truck 01",
    owner: "Municipal fleet",
    capacityL: 2000,
    distanceKm: 8,
    etaMin: 18,
    status: "available",
    statusLabel: "Available",
  },
  {
    id: "partner-truck-01",
    name: "Partner Truck (NGO)",
    owner: "Partner · Red Cross",
    capacityL: 1500,
    distanceKm: 12,
    etaMin: 28,
    status: "available",
    statusLabel: "Available",
  },
  {
    id: "lgu-pickup",
    name: "LGU Pickup",
    owner: "Municipal fleet",
    capacityL: 500,
    distanceKm: 5,
    etaMin: 14,
    status: "available",
    statusLabel: "Available",
  },
  {
    id: "partner-truck-02",
    name: "Partner Truck 02",
    owner: "Partner · civic group",
    capacityL: 1200,
    distanceKm: 15,
    etaMin: 35,
    status: "later",
    statusLabel: "Available later",
  },
];

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
    setQtyL(focusLine.allocateL || focusLine.needL);
    setNotes(
      `Please deliver ${fmtL(focusLine.allocateL || focusLine.needL)} of drinking water to ${focusLine.community}.`,
    );
    setAdded(false);
  }, [focusLine?.reportId, focusLine?.allocateL, focusLine?.needL, focusLine?.community]);

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
  const resourceLabel =
    shortage?.resourceLabel ?? planMeta?.resourceLabel ?? "Drinking water";
  const community = focusLine?.community ?? "Selected community";

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
          href={reviewHref}
          className="text-sm font-medium text-[#2f5f9e] hover:underline"
        >
          ← Back to review & approve plan
        </Link>
        <AllocationPlanStepper current={3} className="mt-4" />
        <h1 className="mt-5 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Track delivery
        </h1>
        <p className="mt-2 max-w-lg text-sm text-[var(--muted)]">
          No transport constraints on the approved plan. Return to review to
          monitor deliveries.
        </p>
        <Link
          href={reviewHref}
          className="mt-4 inline-flex w-fit rounded-lg bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white"
        >
          Back to review
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <Link
        href={reviewHref}
        className="text-sm font-medium text-[#2f5f9e] hover:underline"
      >
        ← Back to review & approve plan
      </Link>

      <AllocationPlanStepper current={3} className="mt-4" />

      <div className="mt-5">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
          Resolve transport constraint
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {community} · {resourceLabel}
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-4 py-3 text-sm text-[var(--foreground)]">
        <span className="font-semibold text-[#b91c1c]">{community}</span> has no
        confirmed transport. {fmtL(needL)} is needed, but no vehicle is
        currently confirmed.
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <section className="min-w-0 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
          <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
            Find available transport
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {["Vehicle type", "Availability", "Capacity", "Distance / sort"].map(
              (label) => (
                <label key={label} className="block text-[12px] text-[var(--muted)]">
                  {label}
                  <select className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-2.5 py-2 text-sm text-[var(--foreground)]">
                    <option>Any</option>
                  </select>
                </label>
              ),
            )}
          </div>

          <ul className="mt-4 space-y-2">
            {VEHICLES.map((v) => {
              const active = v.id === selected.id;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setVehicleId(v.id)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition",
                      active
                        ? "border-[#93c5fd] bg-[#eff6ff]"
                        : "border-[var(--border)] bg-white hover:border-[var(--foreground)]/20",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                        active
                          ? "border-[#2f5f9e] bg-[#2f5f9e]"
                          : "border-[#cbd5e1] bg-white",
                      )}
                      aria-hidden
                    >
                      {active ? (
                        <span className="size-1.5 rounded-full bg-white" />
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {v.name}
                        </p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                            v.status === "available"
                              ? "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60"
                              : "bg-[#fffbeb] text-[#b45309] ring-[#fde68a]",
                          )}
                        >
                          {v.statusLabel}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                        {v.owner} · {fmtL(v.capacityL)} capacity · {v.distanceKm}{" "}
                        km away
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] font-medium text-[#2f5f9e]">
                      View details
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-[var(--border)] bg-white px-3.5 py-3 shadow-sm">
              <p className="text-[12px] text-[var(--muted)]">
                Need for {community}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums text-[#2f5f9e]">
                {fmtL(needL)}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-white px-3.5 py-3 shadow-sm">
              <p className="text-[12px] text-[var(--muted)]">
                Proposed allocation
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums text-[var(--foreground)]">
                {fmtL(focusLine.allocateL)}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[#f8fafc] shadow-sm">
            <div className="relative h-36 bg-[linear-gradient(160deg,#dbeafe_0%,#f1f5f9_55%,#e2e8f0_100%)]">
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <div className="w-full max-w-[16rem]">
                  <div className="flex items-center justify-between text-[11px] font-medium text-[#2f5f9e]">
                    <span>LGU depot</span>
                    <span>{community}</span>
                  </div>
                  <div className="relative mt-2 h-1.5 rounded-full bg-white/80">
                    <div className="absolute inset-y-0 left-0 w-[70%] rounded-full bg-[#2f5f9e]" />
                    <span className="absolute top-1/2 left-[70%] size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2f5f9e] ring-2 ring-white" />
                  </div>
                  <p className="mt-2 text-center text-[12px] text-[var(--muted)]">
                    {selected.distanceKm} km · {selected.etaMin} min
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Delivery details
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">Request draft</p>

            <label className="mt-3 block text-[12px] text-[var(--muted)]">
              Quantity to deliver
              <input
                type="number"
                min={0}
                value={qtyL}
                onChange={(e) => setQtyL(Math.max(0, Number(e.target.value) || 0))}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums"
              />
              <span className="mt-1 block text-[11px]">
                {fmtL(needL)} requested
              </span>
            </label>

            <label className="mt-3 block text-[12px] text-[var(--muted)]">
              Delivery date
              <input
                type="text"
                readOnly
                value={defaultDateLabel()}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[#f8fafc] px-3 py-2 text-sm"
              />
            </label>

            <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-lg border border-[var(--border)] bg-[#f8fafc] px-3 py-2">
                <p className="text-[var(--muted)]">Vehicle capacity</p>
                <p className="mt-0.5 font-medium tabular-nums">
                  {fmtL(selected.capacityL)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[#f8fafc] px-3 py-2">
                <p className="text-[var(--muted)]">Available water budget</p>
                <p
                  className={cn(
                    "mt-0.5 font-medium tabular-nums",
                    shortfallL > 0 || unplannedPool === 0
                      ? "text-[#b91c1c]"
                      : "text-[#16794c]",
                  )}
                >
                  {fmtL(unplannedPool)} unplanned
                </p>
              </div>
            </div>

            {shortfallL > 0 ? (
              <div className="mt-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 text-[12px] leading-snug text-[var(--foreground)]">
                <span className="font-semibold text-[#b45309]">
                  {fmtL(unplannedPool)} unplanned
                </span>{" "}
                — allocation change required. Reallocate from existing
                proposals or confirm extra supply before adding this request.{" "}
                <button
                  type="button"
                  onClick={() => router.push(reviewHref)}
                  className="font-semibold text-[#2f5f9e] underline-offset-2 hover:underline"
                >
                  Back to allocation plan
                </button>
              </div>
            ) : null}

            <label className="mt-3 block text-[12px] text-[var(--muted)]">
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm leading-snug"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!canAdd || added}
                onClick={() => setAdded(true)}
                className="inline-flex rounded-lg bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-45"
              >
                {added ? "Added to plan" : "Add to plan"}
              </button>
              <button
                type="button"
                onClick={() => router.push(reviewHref)}
                className="text-sm font-medium text-[#2f5f9e] hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[var(--foreground)]">
            <span className="font-semibold text-[#2f5f9e]">
              What happens next?
            </span>{" "}
            After adding a delivery proposal, review the updated plan and obtain
            human approval later. Selecting transport alone does not reserve
            water or a vehicle.
          </div>
        </aside>
      </div>
    </div>
  );
}
