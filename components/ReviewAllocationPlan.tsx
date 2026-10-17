"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AllocationPlanStepper } from "@/components/AllocationPlanStepper";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import {
  getShortageById,
  saveShortageWorkflowStep,
  setShortageReviewStatus,
} from "@/lib/resourcesShortages/api";
import type { ResourceShortage } from "@/lib/resourcesShortages/types";
import { scopeLabel } from "@/lib/reports/barangayScope";
import type {
  AllocationLine,
  AllocationOption,
} from "@/lib/workspace/allocationOptions";
import {
  buildSupplyShortagePlan,
  reportsForEpicCode,
  type SupplyShortagePlan,
} from "@/lib/workspace/supplyShortagePlan";
import { cn } from "@/lib/utils";

function fmtL(n: number): string {
  return `${n.toLocaleString("en-PH")} L`;
}

function noteFor(line: AllocationLine): string {
  if (line.constraint === "no_blockers") {
    return "Can proceed after final checks.";
  }
  if (line.constraint === "no_transport") {
    return "Transport needed to deliver supplies.";
  }
  return "Requires access confirmation before delivery.";
}

function followUpCopy(line: AllocationLine): string {
  if (line.constraint === "no_transport") {
    return "Find a vehicle, schedule a later delivery, or request partner transport.";
  }
  return "Confirm road conditions and security before finalizing delivery.";
}

function constraintTone(constraint: AllocationLine["constraint"]) {
  if (constraint === "no_blockers") return "text-[#16794c]";
  if (constraint === "no_transport") return "text-[#b91c1c]";
  return "text-[#b45309]";
}

function constraintPill(constraint: AllocationLine["constraint"]) {
  if (constraint === "no_blockers") {
    return "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60";
  }
  if (constraint === "no_transport") {
    return "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]";
  }
  return "bg-[#fffbeb] text-[#b45309] ring-[#fde68a]";
}

function optionLabel(opt: AllocationOption, index: number): string {
  return `Option ${index + 1} — ${opt.title}`;
}

export function ReviewAllocationPlan() {
  const { profile } = useAuth();
  const { reports, scopedReports, reportScope } = useCommandWorkspace();
  const router = useRouter();
  const params = useParams();
  const rsCode = String(params.id ?? "RS-001").trim().toUpperCase() || "RS-001";

  const [shortage, setShortage] = useState<ResourceShortage | null>(null);
  const [lines, setLines] = useState<AllocationLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const existing = await getShortageById(rsCode);
      if (cancelled) return;
      setShortage(existing);
      if (existing?.reviewStatus === "approved" || existing?.workflowStep === 3) {
        return;
      }
      try {
        await saveShortageWorkflowStep(rsCode, 2);
        if (!cancelled) {
          setShortage(await getShortageById(rsCode));
        }
      } catch {
        /* offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rsCode]);

  const selectedOption = useMemo(() => {
    const options = shortage?.allocation?.options ?? [];
    if (options.length === 0) return null;
    const id = shortage?.selectedOptionId || options[0]?.id || "";
    return options.find((o) => o.id === id) ?? options[0] ?? null;
  }, [shortage]);

  const selectedIndex = useMemo(() => {
    const options = shortage?.allocation?.options ?? [];
    if (!selectedOption) return 0;
    const i = options.findIndex((o) => o.id === selectedOption.id);
    return i >= 0 ? i : 0;
  }, [shortage, selectedOption]);

  useEffect(() => {
    if (selectedOption?.lines) {
      setLines(selectedOption.lines.map((l) => ({ ...l })));
    }
  }, [selectedOption]);

  const proposedTotal = useMemo(
    () => lines.reduce((s, l) => s + Math.max(0, l.allocateL), 0),
    [lines],
  );
  const availableL = plan?.availableL ?? shortage?.availableL ?? 0;
  const totalNeededL = plan?.totalNeededL ?? shortage?.totalNeededL ?? 0;
  const unmetL = Math.max(0, totalNeededL - proposedTotal);
  const approved = shortage?.reviewStatus === "approved";

  const followUps = useMemo(
    () =>
      lines.filter(
        (l) =>
          l.constraint === "access_unverified" ||
          l.constraint === "no_transport",
      ),
    [lines],
  );

  async function onSaveDraft() {
    setSaving(true);
    try {
      await setShortageReviewStatus(rsCode, "review_draft");
      const next = await getShortageById(rsCode);
      setShortage(next);
    } finally {
      setSaving(false);
    }
  }

  async function onApprove() {
    setApproving(true);
    try {
      await setShortageReviewStatus(rsCode, "approved");
      const next = await getShortageById(rsCode);
      setShortage(next);
      const opts = next?.allocation?.options ?? [];
      const selectedId = next?.selectedOptionId || opts[0]?.id || "";
      const opt =
        opts.find((o) => o.id === selectedId) ?? opts[0] ?? null;
      const transport =
        opt?.lines.find((l) => l.constraint === "no_transport") ??
        lines.find((l) => l.constraint === "no_transport");
      const track = `/admin/resources/track/${encodeURIComponent(rsCode)}`;
      router.push(
        transport?.reportId
          ? `${track}?report=${encodeURIComponent(transport.reportId)}`
          : track,
      );
    } finally {
      setApproving(false);
    }
  }

  if (!plan && !shortage) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
        <p className="font-medium text-[var(--foreground)]">
          No allocation plan in scope
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

  if (!selectedOption) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
        <p className="font-medium text-[var(--foreground)]">
          Choose an allocation option first
        </p>
        <Link
          href={`/admin/resources/compare/${encodeURIComponent(rsCode)}`}
          className="mt-4 inline-flex rounded-xl bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white"
        >
          Compare options
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Link
          href={`/admin/resources/${encodeURIComponent(rsCode)}`}
          className="text-[12px] font-medium text-[#2f5f9e] hover:underline"
        >
          ← Back to resources
        </Link>
        <div className="text-right text-[12px] text-[var(--muted)]">
          <p>{placeHint}</p>
          <p className="mt-0.5">
            Last updated{" "}
            {shortage?.updatedAt
              ? new Date(shortage.updatedAt).toLocaleString()
              : "—"}
          </p>
        </div>
      </div>

      <AllocationPlanStepper
        current={approved ? 3 : 2}
        className="mt-4"
      />

      <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
              Review allocation plan
            </h1>
            <span className="rounded-md bg-[#e2e8f0] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--muted)]">
              {approved ? "APPROVED" : "DRAFT"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Review the proposed distribution, check delivery constraints, and
            take next actions before approval.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            router.push(
              `/admin/resources/compare/${encodeURIComponent(rsCode)}`,
            )
          }
          className="inline-flex rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
        >
          Change option
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 shadow-sm">
          <p className="text-[12px] text-[var(--muted)]">Total needed</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-wide text-[#2f5f9e]">
            {fmtL(totalNeededL)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            From {plan?.communityCount ?? lines.length}{" "}
            {(plan?.communityCount ?? lines.length) === 1
              ? "community"
              : "communities"}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 shadow-sm">
          <p className="text-[12px] text-[var(--muted)]">Available supply</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-wide text-[#16794c]">
            {fmtL(availableL)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            In LGU warehouse
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 shadow-sm">
          <p className="text-[12px] text-[var(--muted)]">Proposed allocation</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-wide text-[#2f5f9e]">
            {fmtL(proposedTotal)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            {availableL > 0
              ? `${Math.round((proposedTotal / availableL) * 100)}% of available supply`
              : "Of available supply"}
          </p>
        </div>
        <div className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-4 py-4 shadow-sm">
          <p className="text-[12px] text-[var(--muted)]">Projected unmet need</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-wide text-[#c72929]">
            {fmtL(unmetL)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            Remaining after the proposed plan
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)]">
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Community allocation
            </h2>
            <span className="rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-[11px] font-medium text-[#2f5f9e] ring-1 ring-[#bfdbfe]">
              {optionLabel(selectedOption, selectedIndex)} (Selected)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[#f8fafc] text-[12px] text-[var(--muted)]">
                  <th className="px-4 py-2.5 font-medium sm:px-5">
                    Community
                  </th>
                  <th className="px-3 py-2.5 font-medium">Need (L)</th>
                  <th className="px-3 py-2.5 font-medium">
                    Proposed allocation (L)
                  </th>
                  <th className="px-3 py-2.5 font-medium">% of supply</th>
                  <th className="px-3 py-2.5 font-medium">Delivery status</th>
                  <th className="px-4 py-2.5 font-medium sm:px-5">Notes</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const pct =
                    availableL > 0
                      ? Math.round((line.allocateL / availableL) * 100)
                      : 0;
                  return (
                    <tr
                      key={`${line.reportId}-${line.community}`}
                      className="border-b border-[var(--border)]"
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <p className="font-medium text-[var(--foreground)]">
                          {line.community}
                        </p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {fmtL(line.needL)} needed
                        </p>
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {line.needL.toLocaleString("en-PH")}
                      </td>
                      <td className="px-3 py-3">
                        <select
                          disabled={approved}
                          value={line.allocateL}
                          onChange={(e) => {
                            const next = Number(e.target.value) || 0;
                            setLines((prev) =>
                              prev.map((row, idx) =>
                                idx === i
                                  ? { ...row, allocateL: next }
                                  : row,
                              ),
                            );
                          }}
                          className="rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-[13px] tabular-nums"
                        >
                          {Array.from(
                            new Set([
                              0,
                              line.allocateL,
                              ...[0, 100, 200, 240, 300, 400, 500, 600, 700, 800, 900, 1000, 1200].filter(
                                (n) => n <= Math.max(line.needL, line.allocateL),
                              ),
                            ]),
                          )
                            .sort((a, b) => a - b)
                            .map((n) => (
                              <option key={n} value={n}>
                                {n.toLocaleString("en-PH")}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex min-w-[5.5rem] flex-col gap-1">
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                            <div
                              className="h-full rounded-full bg-[#2f5f9e]"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                          <span className="tabular-nums text-[12px] text-[var(--muted)]">
                            {pct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                            constraintPill(line.constraint),
                          )}
                        >
                          {line.constraintLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[var(--muted)] sm:px-5">
                        {noteFor(line)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-[#f8fafc] font-semibold">
                  <td className="px-4 py-3 sm:px-5">Total</td>
                  <td className="px-3 py-3 tabular-nums">
                    {totalNeededL.toLocaleString("en-PH")}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {proposedTotal.toLocaleString("en-PH")}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex min-w-[5.5rem] flex-col gap-1">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
                        <div
                          className="h-full rounded-full bg-[#2f5f9e]"
                          style={{
                            width: `${
                              availableL > 0
                                ? Math.min(
                                    100,
                                    Math.round(
                                      (proposedTotal / availableL) * 100,
                                    ),
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="tabular-nums text-[12px] text-[var(--muted)]">
                        {availableL > 0
                          ? `${Math.round((proposedTotal / availableL) * 100)}%`
                          : "—"}
                      </span>
                    </div>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
          <p className="border-t border-[var(--border)] px-4 py-2.5 text-[11px] text-[var(--muted)] sm:px-5">
            Warehouse supply only. Community local stock is provisional and
            excluded until reconciled.
          </p>
        </section>

        <aside className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Communities that require follow-up
            </h2>
            {followUps.length > 0 ? (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#2f5f9e] text-[11px] font-semibold text-white">
                {followUps.length}
              </span>
            ) : null}
          </div>
          <div className="mt-3 space-y-3">
            {followUps.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                No delivery blockers on the selected option.
              </p>
            ) : (
              followUps.map((line) => {
                const pct =
                  availableL > 0
                    ? Math.round((line.allocateL / availableL) * 100)
                    : 0;
                return (
                  <div
                    key={`${line.reportId}-follow`}
                    className="rounded-xl border border-[var(--border)] bg-[#f8fafc] px-3.5 py-3"
                  >
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {line.community}{" "}
                      <span className={constraintTone(line.constraint)}>
                        — {line.constraintLabel}
                      </span>
                    </p>
                    <p className="mt-1 text-[12px] text-[var(--muted)]">
                      {fmtL(line.allocateL)} proposed ({pct}% of supply)
                    </p>
                    <p className="mt-1 text-[12px] leading-snug text-[var(--muted)]">
                      {followUpCopy(line)}
                    </p>
                    <Link
                      href={
                        line.constraint === "no_transport"
                          ? `/admin/resources/track/${encodeURIComponent(rsCode)}?report=${encodeURIComponent(line.reportId)}`
                          : `/admin/incidents/${encodeURIComponent(line.reportId)}`
                      }
                      className="mt-3 inline-flex rounded-lg border border-[#93c5fd] bg-white px-3 py-2 text-[12px] font-medium text-[#2f5f9e] transition hover:border-[#3b6fb6]"
                    >
                      {line.constraint === "no_transport"
                        ? "Explore transport options"
                        : "Verify access"}
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>

      <div className="mt-5 rounded-2xl border border-[#bfdbfe] bg-[#eff6ff] px-4 py-3 text-sm text-[var(--foreground)]">
        <span className="font-semibold text-[#2f5f9e]">Important.</span>{" "}
        Proposed quantities are not yet reserved or approved. Deliveries require
        resolved access and transport constraints and final approval.
      </div>

      <div className="mt-4 mb-2 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={saving || approved}
          onClick={() => void onSaveDraft()}
          className="inline-flex rounded-lg border border-[#93c5fd] bg-white px-4 py-2.5 text-sm font-medium text-[#2f5f9e] transition hover:border-[#3b6fb6] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save as draft"}
        </button>
        {approved ? (
          <button
            type="button"
            onClick={() => {
              const transport = lines.find((l) => l.constraint === "no_transport");
              const track = `/admin/resources/track/${encodeURIComponent(rsCode)}`;
              router.push(
                transport?.reportId
                  ? `${track}?report=${encodeURIComponent(transport.reportId)}`
                  : track,
              );
            }}
            className="inline-flex rounded-lg bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#254d82]"
          >
            Continue to track delivery
          </button>
        ) : (
          <button
            type="button"
            disabled={approving || proposedTotal <= 0}
            onClick={() => void onApprove()}
            className="inline-flex rounded-lg bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#254d82] disabled:opacity-50"
          >
            {approving ? "Approving…" : "Approve selected deliveries"}
          </button>
        )}
      </div>
    </div>
  );
}
