"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
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

type TabId = "deliveries" | "pending" | "all";

type DemoDelivery = {
  community: string;
  reportId: string;
  needL: number;
  quantityL: number;
  vehicle: string;
  vehicleCapL: number;
  status: "dispatched" | "en_route" | "delivered";
  etaLabel: string;
};

function fmtL(n: number): string {
  return `${n.toLocaleString("en-PH")} L`;
}

function etaTomorrowLabel(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(d);
}

function clockLabel(offsetMin: number): string {
  const d = new Date(Date.now() - offsetMin * 60 * 1000);
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  }).format(d);
}

export function TrackAssistance() {
  const params = useParams();
  const { reports, scopedReports } = useCommandWorkspace();
  const rsCode =
    String(params.id ?? "RS-001").trim().toUpperCase() || "RS-001";

  const [shortage, setShortage] = useState<ResourceShortage | null>(null);
  const [tab, setTab] = useState<TabId>("deliveries");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const doc = await getShortageById(rsCode);
      if (cancelled) return;
      setShortage(doc);
      try {
        await saveShortageWorkflowStep(rsCode, 3);
      } catch {
        /* offline */
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

  const readyLines = useMemo(
    () => lines.filter((l) => l.constraint === "no_blockers" && l.allocateL > 0),
    [lines],
  );
  const pendingLines = useMemo(
    () =>
      lines.filter(
        (l) =>
          l.constraint === "access_unverified" ||
          l.constraint === "no_transport",
      ),
    [lines],
  );

  const deliveries: DemoDelivery[] = useMemo(() => {
    const first = readyLines[0];
    if (!first) return [];
    return [
      {
        community: first.community,
        reportId: first.reportId,
        needL: first.needL,
        quantityL: first.allocateL,
        vehicle: "LGU Water Truck 01",
        vehicleCapL: 2000,
        status: "dispatched",
        etaLabel: etaTomorrowLabel(),
      },
    ];
  }, [readyLines]);

  const totalNeededL =
    shortage?.totalNeededL ??
    planMeta?.totalNeededL ??
    lines.reduce((s, l) => s + l.needL, 0);
  const committedL = deliveries.reduce((s, d) => s + d.quantityL, 0);
  const pendingL = pendingLines
    .filter((l) => l.constraint === "access_unverified")
    .reduce((s, l) => s + Math.max(l.allocateL, l.needL), 0);
  const unmetL = Math.max(0, totalNeededL - committedL - pendingL);
  const communityCount =
    shortage?.communityCount ?? planMeta?.communityCount ?? lines.length;

  const pct = (n: number) =>
    totalNeededL > 0 ? Math.round((n / totalNeededL) * 100) : 0;

  const transportHref = (reportId: string) =>
    `/admin/resources/track/${encodeURIComponent(rsCode)}/transport?report=${encodeURIComponent(reportId)}`;

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "deliveries", label: "Deliveries", count: deliveries.length },
    { id: "pending", label: "Pending needs", count: pendingLines.length },
    { id: "all", label: "All communities", count: lines.length || communityCount },
  ];

  const activity = [
    {
      time: clockLabel(0),
      title: "Delivery dispatched",
      detail: deliveries[0]
        ? `${deliveries[0].community} · ${fmtL(deliveries[0].quantityL)} · ${deliveries[0].vehicle}`
        : "Plan approved",
    },
    {
      time: clockLabel(75),
      title: "Access verification requested",
      detail: pendingLines.find((l) => l.constraint === "access_unverified")
        ? `${pendingLines.find((l) => l.constraint === "access_unverified")!.community} · ground check`
        : "Pending communities flagged",
    },
    {
      time: clockLabel(120),
      title: "Transport needed",
      detail: pendingLines.find((l) => l.constraint === "no_transport")
        ? `${pendingLines.find((l) => l.constraint === "no_transport")!.community} · no vehicle confirmed`
        : "No transport blockers",
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <Link
        href="/admin/resources"
        className="text-sm font-medium text-[#2f5f9e] hover:underline"
      >
        ← Back to resources
      </Link>

      <AllocationPlanStepper current={3} className="mt-4" />

      <div className="mt-5">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
          Track assistance
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
          Monitor the status of approved deliveries, pending requests, and
          remaining needs.
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total needed"
          value={fmtL(totalNeededL)}
          hint={`From ${communityCount} ${communityCount === 1 ? "community" : "communities"}`}
          tone="blue"
        />
        <KpiCard
          label="Committed for delivery"
          value={fmtL(committedL)}
          hint={`${deliveries.length} ${deliveries.length === 1 ? "delivery" : "deliveries"}`}
          tone="green"
        />
        <KpiCard
          label="Pending"
          value={fmtL(pendingL)}
          hint={`${pendingLines.filter((l) => l.constraint === "access_unverified").length} ${
            pendingLines.filter((l) => l.constraint === "access_unverified")
              .length === 1
              ? "community"
              : "communities"
          }`}
          tone="amber"
        />
        <KpiCard
          label="Unmet need"
          value={fmtL(unmetL)}
          hint="After this plan"
          tone="red"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(16rem,0.72fr)] lg:items-start">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative px-3 py-2.5 text-sm font-medium transition",
                  tab === t.id
                    ? "text-[#2f5f9e]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {t.label} ({t.count})
                {tab === t.id ? (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#2f5f9e]" />
                ) : null}
              </button>
            ))}
          </div>

          {(tab === "deliveries" || tab === "all") && (
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
              <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
                <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                  Approved deliveries
                </h2>
              </div>
              {deliveries.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[var(--muted)] sm:px-5">
                  No deliveries dispatched yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[#f8fafc] text-[12px] text-[var(--muted)]">
                        <th className="px-4 py-2.5 font-medium sm:px-5">
                          Community
                        </th>
                        <th className="px-3 py-2.5 font-medium">Quantity</th>
                        <th className="px-3 py-2.5 font-medium">Vehicle</th>
                        <th className="px-3 py-2.5 font-medium">Status</th>
                        <th className="px-3 py-2.5 font-medium">
                          ETA / delivery date
                        </th>
                        <th className="px-4 py-2.5 font-medium sm:px-5">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map((d) => (
                        <tr
                          key={d.reportId}
                          className="border-b border-[var(--border)]"
                        >
                          <td className="px-4 py-3 sm:px-5">
                            <p className="font-medium">{d.community}</p>
                            <p className="text-[11px] text-[var(--muted)]">
                              {fmtL(d.needL)} needed
                            </p>
                          </td>
                          <td className="px-3 py-3 tabular-nums font-medium">
                            {fmtL(d.quantityL)}
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium">{d.vehicle}</p>
                            <p className="text-[11px] text-[var(--muted)]">
                              {fmtL(d.vehicleCapL)} capacity
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <DeliveryStatus status={d.status} />
                          </td>
                          <td className="px-3 py-3 text-[12px] text-[var(--muted)]">
                            {d.etaLabel}
                          </td>
                          <td className="px-4 py-3 sm:px-5">
                            <Link
                              href={`/admin/incidents/${encodeURIComponent(d.reportId)}`}
                              className="inline-flex rounded-lg border border-[#93c5fd] bg-white px-3 py-1.5 text-[12px] font-medium text-[#2f5f9e] transition hover:border-[#3b6fb6]"
                            >
                              View details
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {(tab === "pending" || tab === "all" || tab === "deliveries") && (
            <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
              <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
                <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                  Pending needs
                </h2>
              </div>
              {pendingLines.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[var(--muted)] sm:px-5">
                  No pending blockers on this plan.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[#f8fafc] text-[12px] text-[var(--muted)]">
                        <th className="px-4 py-2.5 font-medium sm:px-5">
                          Community
                        </th>
                        <th className="px-3 py-2.5 font-medium">Quantity</th>
                        <th className="px-3 py-2.5 font-medium">Issue</th>
                        <th className="px-3 py-2.5 font-medium">Next step</th>
                        <th className="px-4 py-2.5 font-medium sm:px-5">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingLines.map((l) => {
                        const qty = Math.max(l.allocateL, l.needL);
                        const isTransport = l.constraint === "no_transport";
                        return (
                          <tr
                            key={l.reportId}
                            className="border-b border-[var(--border)]"
                          >
                            <td className="px-4 py-3 font-medium sm:px-5">
                              {l.community}
                            </td>
                            <td className="px-3 py-3 tabular-nums font-medium">
                              {fmtL(qty)}
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                                  isTransport
                                    ? "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]"
                                    : "bg-[#fffbeb] text-[#b45309] ring-[#fde68a]",
                                )}
                              >
                                {l.constraintLabel}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-[12px] text-[var(--muted)]">
                              {isTransport
                                ? "Find a vehicle, schedule a later delivery, or request partner transport."
                                : "Verify access with local authorities."}
                            </td>
                            <td className="px-4 py-3 sm:px-5">
                              <Link
                                href={
                                  isTransport
                                    ? transportHref(l.reportId)
                                    : `/admin/incidents/${encodeURIComponent(l.reportId)}`
                                }
                                className="inline-flex rounded-lg border border-[#93c5fd] bg-white px-3 py-1.5 text-[12px] font-medium text-[#2f5f9e] transition hover:border-[#3b6fb6]"
                              >
                                {isTransport
                                  ? "Resolve transport"
                                  : "Verify access"}
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Total progress
            </h2>
            <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[#e2e8f0]">
              <span
                className="bg-[#2f5f9e]"
                style={{ width: `${pct(committedL)}%` }}
              />
              <span
                className="bg-[#eab308]"
                style={{ width: `${pct(pendingL)}%` }}
              />
              <span
                className="bg-[#94a3b8]"
                style={{ width: `${pct(unmetL)}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--muted)]">
              <span>
                <span className="font-medium text-[#2f5f9e]">
                  {pct(committedL)}%
                </span>{" "}
                Committed
              </span>
              <span>
                <span className="font-medium text-[#b45309]">
                  {pct(pendingL)}%
                </span>{" "}
                Pending
              </span>
              <span>
                <span className="font-medium text-[var(--foreground)]">
                  {pct(unmetL)}%
                </span>{" "}
                Unmet need
              </span>
            </div>
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4">
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                Map view
              </h2>
              <Link
                href={`/admin/resources/${encodeURIComponent(rsCode)}`}
                className="text-[12px] font-medium text-[#2f5f9e] hover:underline"
              >
                View full map
              </Link>
            </div>
            <div className="relative h-44 bg-[linear-gradient(165deg,#c7d9f0_0%,#e8eef6_45%,#d4dde8_100%)]">
              <div className="absolute inset-0 flex items-center justify-center gap-6 px-4">
                {(["A", "B", "C"] as const).map((letter, i) => {
                  const tones = [
                    "bg-[#2f5f9e] ring-[#93c5fd]",
                    "bg-[#eab308] ring-[#fde68a]",
                    "bg-[#b91c1c] ring-[#fecaca]",
                  ];
                  const labels = [
                    deliveries[0]?.community ?? "Sitio A",
                    pendingLines.find((l) => l.constraint === "access_unverified")
                      ?.community ?? "Sitio B",
                    pendingLines.find((l) => l.constraint === "no_transport")
                      ?.community ?? "Sitio C",
                  ];
                  const statuses = [
                    "Dispatched",
                    "Pending",
                    "Not scheduled",
                  ];
                  return (
                    <div key={letter} className="flex flex-col items-center gap-1">
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full text-[12px] font-semibold text-white ring-2",
                          tones[i],
                        )}
                      >
                        {letter}
                      </span>
                      <p className="max-w-[5.5rem] truncate text-center text-[10px] font-medium text-[var(--foreground)]">
                        {labels[i]}
                      </p>
                      <p className="text-[10px] text-[var(--muted)]">
                        {statuses[i]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Community progress
            </h2>
            <ul className="mt-3 space-y-3">
              {(lines.length > 0 ? lines : []).slice(0, 5).map((l) => {
                const filled =
                  l.needL > 0
                    ? Math.min(
                        100,
                        Math.round((l.allocateL / l.needL) * 100),
                      )
                    : 0;
                const bar =
                  l.constraint === "no_blockers"
                    ? "bg-[#2f5f9e]"
                    : l.constraint === "access_unverified"
                      ? "bg-[#eab308]"
                      : "bg-[#94a3b8]";
                return (
                  <li key={l.reportId}>
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="truncate font-medium">
                        {l.community}
                      </span>
                      <span className="tabular-nums text-[var(--muted)]">
                        {filled}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e2e8f0]">
                      <div
                        className={cn("h-full rounded-full", bar)}
                        style={{ width: `${filled}%` }}
                      />
                    </div>
                  </li>
                );
              })}
              {lines.length === 0 ? (
                <li className="text-sm text-[var(--muted)]">
                  No community rows yet.
                </li>
              ) : null}
            </ul>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Recent activity
            </h2>
            <ul className="mt-3 space-y-3">
              {activity.map((a) => (
                <li key={a.title} className="flex gap-3">
                  <span className="mt-1 size-2 shrink-0 rounded-full bg-[#2f5f9e]" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-[11px] text-[var(--muted)]">{a.time}</p>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                      {a.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: "blue" | "green" | "amber" | "red";
}) {
  const valueColor =
    tone === "blue"
      ? "text-[#2f5f9e]"
      : tone === "green"
        ? "text-[#16794c]"
        : tone === "amber"
          ? "text-[#b45309]"
          : "text-[#b91c1c]";
  const ring =
    tone === "red"
      ? "border-[#fecaca] bg-[#fff7f7]"
      : "border-[var(--border)] bg-white";
  return (
    <div className={cn("rounded-2xl border px-4 py-4 shadow-sm", ring)}>
      <p className="text-[12px] text-[var(--muted)]">{label}</p>
      <p
        className={cn(
          "mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-wide",
          valueColor,
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[12px] text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function DeliveryStatus({
  status,
}: {
  status: DemoDelivery["status"];
}) {
  const steps = [
    { id: "dispatched", label: "Dispatched" },
    { id: "en_route", label: "En route" },
    { id: "delivered", label: "Delivered" },
  ] as const;
  const idx = steps.findIndex((s) => s.id === status);
  return (
    <div>
      <p className="text-[12px] font-semibold text-[#2f5f9e]">
        {steps[idx]?.label ?? status}
      </p>
      <div className="mt-1.5 flex items-center gap-1">
        {steps.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1">
            <span
              className={cn(
                "size-2 rounded-full",
                i <= idx ? "bg-[#2f5f9e]" : "bg-[#cbd5e1]",
              )}
            />
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "h-0.5 w-4",
                  i < idx ? "bg-[#2f5f9e]" : "bg-[#e2e8f0]",
                )}
              />
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}
