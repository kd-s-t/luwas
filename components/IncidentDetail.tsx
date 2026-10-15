"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { CommandContentSkeleton } from "@/components/PageLoadSkeleton";
import { Button } from "@/components/ui/button";
import { triggerAutoResponderCall } from "@/lib/alerts/autoResponderCall";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import {
  assignReportInvestigator,
  subscribeHazardReportById,
  updateReportStatus,
  updateReportValidation,
} from "@/lib/reports/api";
import { reportInScope } from "@/lib/reports/barangayScope";
import { syncHazardReportToBigQuery } from "@/lib/reports/bigquerySync";
import {
  displayReportNotes,
  displayVoiceNoteLabel,
} from "@/lib/reports/displayNotes";
import {
  hazardHintLabel,
  type HazardReport,
  type ReportStatus,
} from "@/lib/reports/types";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { cn } from "@/lib/utils";
import {
  proposalsForReport,
  relatedReports,
  unknownsForReport,
} from "@/lib/workspace/incidentDerived";

const HallPinMap = dynamic(() => import("@/components/HallPinMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[180px] w-full items-center justify-center border border-[var(--border)] bg-[var(--surface)] font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
      Loading map…
    </div>
  ),
});

type IncidentDetailProps = {
  reportId: string;
};

function formatReceivedPht(iso: string): string {
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Manila",
    }).format(d);
    const time = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    }).format(d);
    return `${date} · ${time} PHT`;
  } catch {
    return new Date(iso).toLocaleString();
  }
}

function mediaFileLabel(report: HazardReport): string {
  const path = report.mediaPath || report.mediaUrl || "";
  const base = path.split("?")[0]?.split("/").pop() || "photo.jpg";
  const kind = report.mediaType === "video" ? "1 video" : "1 photo";
  return `${decodeURIComponent(base)} · ${kind}`;
}

function statusHeadline(report: HazardReport): string {
  if (report.status === "done") return "Done · Closed";
  if (report.status === "dispatched") {
    return report.investigatorName
      ? `Dispatched · ${report.investigatorName}`
      : "Dispatched · No responder named";
  }
  if (report.status === "legit") {
    return report.investigatorName
      ? "Verified · Assigned"
      : "Verified · Not assigned";
  }
  if (report.status === "assigned") {
    return report.investigatorName
      ? `Assigned · ${report.investigatorName}`
      : "Assigned · Needs officer name";
  }
  if (report.status === "rejected") return "Rejected · Closed";
  if (report.status === "validating") return "Validating · Hold";
  if (report.investigatorName) return "Queue · Assigned";
  return "Queue · Not assigned";
}

function nextPipelineStep(
  status: ReportStatus,
): { status: ReportStatus; label: string } | null {
  if (
    status === "queued" ||
    status === "validating" ||
    status === "needs_review" ||
    status === "failed"
  ) {
    return { status: "assigned", label: "Move to Assigned" };
  }
  if (status === "assigned") return { status: "legit", label: "Mark verified" };
  if (status === "legit") return { status: "dispatched", label: "Dispatch" };
  if (status === "dispatched") return { status: "done", label: "Mark done" };
  return null;
}

function proposalTitle(report: HazardReport): string {
  if (report.hazardHint === "flood" || report.hazardHint === "typhoon") {
    return "Possible evacuation assistance";
  }
  if (report.hazardHint === "landslide") {
    return "Possible site safety check";
  }
  if (report.hazardHint === "fire") {
    return "Possible fire response follow-up";
  }
  return `Possible ${hazardHintLabel(report.hazardHint).toLowerCase()} follow-up`;
}

export function IncidentDetail({ reportId }: IncidentDetailProps) {
  const { profile } = useAuth();
  const { reportScope, scopedReports } = useCommandWorkspace();
  const [busy, setBusy] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [directReport, setDirectReport] = useState<HazardReport | null>(null);
  const [directReady, setDirectReady] = useState(false);

  useEffect(() => {
    setDirectReady(false);
    setDirectReport(null);
    return subscribeHazardReportById(reportId, (row) => {
      setDirectReport(row);
      setDirectReady(true);
    });
  }, [reportId]);

  const fromList = useMemo(
    () => scopedReports.find((r) => r.id === reportId) ?? null,
    [scopedReports, reportId],
  );
  const candidate = fromList ?? directReport;
  const selected =
    candidate && reportInScope(candidate, reportScope) ? candidate : null;
  const loading = !selected && !directReady;

  const unknowns = selected ? unknownsForReport(selected) : [];
  const proposals = selected ? proposalsForReport(selected) : [];
  const related = selected ? relatedReports(selected, scopedReports) : [];

  async function assignInvestigator(
    investigatorUid: string | null,
    investigatorName: string | null,
  ) {
    if (!selected) return;
    setBusy(true);
    try {
      await assignReportInvestigator({
        reportId: selected.id,
        investigatorUid,
        investigatorName,
      });
    } finally {
      setBusy(false);
    }
  }

  async function override(verdict: "legit" | "rejected") {
    if (!selected) return;
    setBusy(true);
    try {
      const validatedAt = new Date().toISOString();
      await updateReportValidation(selected.id, {
        status: verdict,
        aiVerdict: verdict,
        aiConfidence: selected.aiConfidence ?? 1,
        aiReason:
          `Officer override → ${verdict}. ${selected.aiReason ?? ""}`.trim(),
        aiSource: selected.aiSource,
        aiModel: selected.aiModel,
        validatedAt,
        trustInput: {
          registered: Boolean(selected.citizenUid),
          idVerified: selected.reporterIdVerified,
          email: selected.reporterEmail,
          phone: selected.reporterPhone,
          emailVerified: selected.reporterEmailVerified,
          mediaSource: selected.mediaSource,
          lat: selected.lat,
          lng: selected.lng,
          locationAccuracyM: selected.locationAccuracyM,
        },
      });
      if (verdict === "rejected" && isOfficer(profile)) {
        await assignReportInvestigator({
          reportId: selected.id,
          investigatorUid: profile.uid,
          investigatorName: profile.displayName,
        });
      }
      syncHazardReportToBigQuery({
        ...selected,
        status: verdict,
        aiVerdict: verdict,
        validatedAt,
        ...(verdict === "rejected" && isOfficer(profile)
          ? {
              investigatorUid: profile.uid,
              investigatorName: profile.displayName,
              investigatedAt: validatedAt,
            }
          : {}),
      });
      if (verdict === "legit") {
        void triggerAutoResponderCall({
          ...selected,
          status: "legit",
          autoResponderCallAt: selected.autoResponderCallAt ?? null,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function escalate() {
    if (!selected || !isOfficer(profile)) return;
    setBusy(true);
    try {
      await assignInvestigator(
        profile.uid,
        profile.displayName || profile.email,
      );
      await override("legit");
    } finally {
      setBusy(false);
    }
  }

  async function advancePipeline(next: ReportStatus) {
    if (!selected) return;
    setBusy(true);
    try {
      if (next === "assigned") {
        if (isOfficer(profile) && !selected.investigatorUid) {
          await assignInvestigator(
            profile.uid,
            profile.displayName || profile.email,
          );
          return;
        }
        await updateReportStatus(selected.id, "assigned");
        return;
      }
      if (next === "legit") {
        await override("legit");
        return;
      }
      await updateReportStatus(selected.id, next);
    } finally {
      setBusy(false);
    }
  }

  const pipelineNext = selected ? nextPipelineStep(selected.status) : null;

  if (loading) {
    return <CommandContentSkeleton fill />;
  }

  if (!selected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Incident not found
        </p>
        <p className="max-w-md text-sm text-[var(--muted)]">
          This report is missing, out of scope, or was removed.
        </p>
        <Link
          href="/admin/incidents"
          className="text-sm text-[var(--accent)] hover:underline"
        >
          ← Back to incidents
        </Link>
      </div>
    );
  }

  const notes = displayReportNotes(selected.notes);
  const place =
    selected.locationLabel?.trim() ||
    (selected.citizenPurok
      ? `${selected.citizenPurok}, Brgy. ${selected.barangay}`
      : `Brgy. ${selected.barangay}${selected.lgu ? `, ${selected.lgu}` : ""}`);
  const phone = selected.reporterPhone?.trim() || null;
  const requestDetailsHref = phone
    ? `tel:${phone.replace(/[^\d+]/g, "")}`
    : undefined;
  const intake =
    selected.status === "queued" ||
    selected.status === "validating" ||
    selected.status === "needs_review" ||
    selected.status === "failed" ||
    selected.status === "assigned";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--surface-raised)]">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide sm:text-4xl">
              Review citizen report
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              <span className="font-mono tabular-nums text-[var(--foreground)]">
                {selected.id}
              </span>
              {" · "}
              {selected.barangay}
              {selected.lgu ? `, ${selected.lgu}` : ""}
            </p>
          </div>
          <Link
            href="/admin/incidents"
            className="shrink-0 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            ← Back to incidents
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <ReportStatusBadge status={selected.status} />
          <span className="inline-flex border border-[#c45c12]/30 bg-[#f3e6d8] px-2.5 py-1 text-xs font-medium text-[#8a4b1a]">
            {statusHeadline(selected)}
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
          {selected.lgu || "Response"} area
          {selected.investigatorName
            ? ` · Reviewer ${selected.investigatorName}.`
            : " · Reviewer not yet recorded."}{" "}
          {selected.investigatorName
            ? "Confirm arrival before marking field-verified."
            : "No responder or arrival time is confirmed."}
        </p>

        <div className="mt-6 grid gap-4 lg:grid-cols-2 lg:gap-5">
          {/* Citizen evidence */}
          <section className="border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
            <span className="inline-flex border border-[#c45c12]/30 bg-[#f3e6d8] px-2 py-0.5 font-mono text-[10px] tracking-wide text-[#8a4b1a] uppercase">
              Citizen evidence · Not verified
            </span>

            <h2 className="mt-4 font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
              What the citizen reported
            </h2>
            {notes ? (
              <blockquote className="mt-2 border-l-2 border-[var(--border)] pl-3 text-sm leading-relaxed text-[var(--foreground)]">
                “{notes}”
              </blockquote>
            ) : (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No written notes attached.
                {selected.title ? ` Title: ${selected.title}` : ""}
              </p>
            )}
            <p className="mt-2 text-xs text-[var(--muted)]">
              Received {formatReceivedPht(selected.createdAt)}
            </p>

            {selected.voiceUrl || selected.voiceTranscript ? (
              <div className="mt-3 space-y-1.5 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5">
                <p className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                  Voice note
                  {(() => {
                    const when = displayVoiceNoteLabel(selected.voiceNoteLabel);
                    return when ? ` · ${when}` : "";
                  })()}
                </p>
                {selected.voiceUrl ? (
                  <audio
                    controls
                    preload="metadata"
                    src={selected.voiceUrl}
                    className="h-9 w-full"
                  >
                    <track kind="captions" />
                  </audio>
                ) : null}
                {selected.voiceTranscript ? (
                  <p className="text-sm leading-relaxed break-words">
                    {selected.voiceTranscript}
                  </p>
                ) : null}
              </div>
            ) : null}

            <h3 className="mt-5 font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Original photo & location
            </h3>
            <div className="mt-2 overflow-hidden border border-[var(--border)] bg-[var(--surface-panel)]">
              {selected.mediaUrl ? (
                selected.mediaType === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.mediaUrl}
                    alt=""
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <video
                    src={selected.mediaUrl}
                    className="aspect-[4/3] w-full object-cover"
                    controls
                  />
                )
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center text-sm text-[var(--muted)]">
                  No media attached
                </div>
              )}
            </div>
            <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">
              {mediaFileLabel(selected)}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Photo alone does not confirm hazard depth or a safe route.
            </p>
            <p className="mt-2 text-sm text-[var(--foreground)]">
              {place}
              <span className="text-[var(--muted)]">
                {" "}
                · approximate citizen-pinned location. GPS precision and safe
                approach are not verified.
              </span>
            </p>
            {selected.lat != null && selected.lng != null ? (
              <div className="mt-3 border border-[var(--border)]">
                <HallPinMap
                  center={{ lat: selected.lat, lng: selected.lng }}
                  zoom={16}
                  className="h-[180px] w-full"
                />
              </div>
            ) : null}

            <h3 className="mt-5 font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Details still needed
            </h3>
            {unknowns.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No critical gaps flagged from this submission. Still confirm
                pickup, contact, and approach before dispatch.
              </p>
            ) : (
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--foreground)]">
                {unknowns.map((u) => (
                  <li key={u.id}>
                    <span className="font-medium">{u.label}</span>
                    <span className="text-[var(--muted)]"> — {u.detail}</span>
                  </li>
                ))}
              </ul>
            )}

            {related.length > 0 ? (
              <div className="mt-4">
                <p className="mb-2 text-xs text-[var(--muted)]">
                  {related.length} related report
                  {related.length === 1 ? "" : "s"} in this barangay
                </p>
                <ul className="space-y-1">
                  {related.map((r) => (
                    <li key={r.id}>
                      <Link
                        href={`/admin/incidents/${encodeURIComponent(r.id)}`}
                        className="text-sm text-[var(--accent)] hover:underline"
                      >
                        Compare · {r.id}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/admin/incidents">Compare other reports →</Link>
              </Button>
            )}

            <p className="mt-5 text-xs text-[var(--muted)]">
              A citizen submission is source evidence, not an operational
              incident
              {intake ? ". No incident is linked yet." : "."}
            </p>
          </section>

          {/* AI suggestions */}
          <section className="border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
            <span className="inline-flex border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-2 py-0.5 font-mono text-[10px] tracking-wide text-[var(--accent)] uppercase">
              AI suggestions · Human review
            </span>

            <h2 className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
              {proposalTitle(selected)}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {selected.aiReason
                ? selected.aiReason
                : "AI can organize reported needs and landmarks from the text. This is not verification of the need, depth, or route."}
              {selected.aiSource
                ? ` (${
                    selected.aiSource === "gemini"
                      ? "Gemini"
                      : "local rules"
                  }${
                    selected.aiConfidence != null
                      ? ` · ${Math.round(selected.aiConfidence * 100)}%`
                      : ""
                  })`
                : ""}
            </p>

            <button
              type="button"
              onClick={() => setWhyOpen((v) => !v)}
              className="mt-3 text-sm font-medium text-[var(--accent)] hover:underline"
              aria-expanded={whyOpen}
            >
              Why this recommendation? {whyOpen ? "▾" : "→"}
            </button>
            {whyOpen ? (
              <ul className="mt-2 space-y-2 border border-[var(--border)] bg-[var(--surface-raised)] p-3">
                {proposals.map((p) => (
                  <li key={p.id}>
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {p.detail}
                    </p>
                  </li>
                ))}
                {proposals.length === 0 ? (
                  <li className="text-sm text-[var(--muted)]">
                    No structured proposals yet. Review the evidence and request
                    details if needed.
                  </li>
                ) : null}
              </ul>
            ) : null}

            <div className="mt-5 flex flex-col gap-2">
              {pipelineNext ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void advancePipeline(pipelineNext.status)}
                >
                  {pipelineNext.label}
                </Button>
              ) : null}
              {requestDetailsHref ? (
                <Button asChild variant="outline" disabled={busy}>
                  <a href={requestDetailsHref}>Request details</a>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setWhyOpen(true)}
                >
                  Request details
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={busy || !isOfficer(profile)}
                onClick={() => void escalate()}
              >
                Escalate Urgent Report
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy || selected.status === "rejected" || selected.status === "done"}
                onClick={() => void override("rejected")}
                className="text-[var(--muted)]"
              >
                Reject report
              </Button>
            </div>

            <div className="mt-4 border-t border-[var(--border)] pt-4">
              {isOfficer(profile) &&
              selected.investigatorUid !== profile.uid ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void assignInvestigator(
                      profile.uid,
                      profile.displayName || profile.email,
                    )
                  }
                  className={cn(
                    "text-sm font-medium text-[var(--accent)] hover:underline disabled:opacity-50",
                  )}
                >
                  Assign me as reviewer →
                </button>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  {selected.investigatorName
                    ? `Assigned to ${selected.investigatorName}`
                    : "Link to an incident or create a new one after verification →"}
                </p>
              )}
            </div>
          </section>
        </div>

        <p className="mt-6 text-center text-[11px] text-[var(--muted)]">
          Shared citizen reference · Assistance is not guaranteed
        </p>
      </div>
    </div>
  );
}
