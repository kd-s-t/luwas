"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { CommandContentSkeleton } from "@/components/PageLoadSkeleton";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  dispatchBarangayInventoryItem,
  ensureActiveBarangayInventory,
  subscribeBarangayInventory,
} from "@/lib/inventory/api";
import { suggestInventoryForHazard } from "@/lib/inventory/suggestForHazard";
import type { InventoryItem } from "@/lib/inventory/types";
import {
  APAS_BARANGAY_DOC_ID,
  APAS_STAFF_SEED,
} from "@/lib/staff/apasStaff";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_STAFF_SEED,
} from "@/lib/staff/nangkaStaff";

const HallPinMap = dynamic(() => import("@/components/HallPinMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[200px] w-full items-center justify-center border border-[var(--border)] bg-[var(--surface)] font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase sm:h-[240px]">
      Loading map…
    </div>
  ),
});
import { triggerAutoResponderCall } from "@/lib/alerts/autoResponderCall";
import { triggerInvestigatorNotify } from "@/lib/alerts/notifyInvestigator";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isDeveloper,
  isOfficer,
  type OfficerProfile,
} from "@/lib/auth/types";
import {
  addReportFieldEvidence,
  assignReportInvestigator,
  setReportManualDispatchChecked,
  subscribeHazardReportById,
  updateReportStatus,
  updateReportValidation,
} from "@/lib/reports/api";
import { reportInScope } from "@/lib/reports/barangayScope";
import { syncHazardReportToBigQuery } from "@/lib/reports/bigquerySync";
import {
  hazardHintLabel,
  type HazardReport,
  type ReportStatus,
} from "@/lib/reports/types";
import {
  TRUST_CAPS,
  trustLabel,
  type ReportTrustBreakdown,
} from "@/lib/reports/trustScore";
import { cn } from "@/lib/utils";
import {
  displayReportNotes,
  displayVoiceNoteLabel,
} from "@/lib/reports/displayNotes";
import {
  activityForReport,
  proposalsForReport,
  relatedReports,
  unknownsForReport,
} from "@/lib/workspace/incidentDerived";
import { parseReportNeed } from "@/lib/workspace/reportNeed";

type PlanState = {
  notes: string;
  recordedAt: string | null;
};

type IncidentDetailProps = {
  reportId: string;
  /** Override board back-link (developer console uses /dev/incidents). */
  backHref?: string;
};

export function IncidentDetail({
  reportId,
  backHref = "/admin/incidents",
}: IncidentDetailProps) {
  const { profile } = useAuth();
  const {
    reportScope,
    scopedReports,
    activeOfficers,
  } = useCommandWorkspace();
  const [busy, setBusy] = useState(false);
  const [activityOpen, setActivityOpen] = useState(true);
  const [plan, setPlan] = useState<PlanState>({ notes: "", recordedAt: null });
  const [planDraft, setPlanDraft] = useState("");
  const [directReport, setDirectReport] = useState<HazardReport | null>(null);
  const [directReady, setDirectReady] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryBusy, setInventoryBusy] = useState(false);

  const scoped = scopedReports;
  const officers = activeOfficers;
  const globalView = isDeveloper(profile);

  const inventoryBarangayId = useMemo(() => {
    if (!isOfficer(profile)) return NANGKA_BARANGAY_ID;
    const areaId = (profile.areaId ?? profile.activeBarangayId)?.trim() ?? "";
    if (areaId.includes("apas")) return APAS_BARANGAY_DOC_ID;
    return NANGKA_BARANGAY_ID;
  }, [profile]);

  useEffect(() => {
    setDirectReady(false);
    setDirectReport(null);
    return subscribeHazardReportById(reportId, (row) => {
      setDirectReport(row);
      setDirectReady(true);
    });
  }, [reportId]);

  useEffect(() => {
    if (!isOfficer(profile)) {
      setInventory([]);
      return;
    }
    void ensureActiveBarangayInventory().catch(() => {});
    return subscribeBarangayInventory(inventoryBarangayId, setInventory);
  }, [profile, inventoryBarangayId]);

  const fromList = useMemo(
    () => scoped.find((r) => r.id === reportId) ?? null,
    [scoped, reportId],
  );
  const candidate = fromList ?? directReport;
  const selected =
    candidate &&
    (globalView || reportInScope(candidate, reportScope))
      ? candidate
      : null;
  const loading = !selected && !directReady;

  useEffect(() => {
    if (!selected) {
      setPlanDraft("");
      return;
    }
    setPlanDraft(plan.notes);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- reset draft when incident changes

  const unknowns = selected ? unknownsForReport(selected) : [];
  const proposals = selected ? proposalsForReport(selected) : [];
  const related = selected ? relatedReports(selected, scoped) : [];
  const activity = selected ? activityForReport(selected) : [];
  const inventorySuggestions = selected
    ? suggestInventoryForHazard(selected.hazardHint, inventory)
    : [];

  async function dispatchSuggestedStock(item: InventoryItem) {
    if (!isOfficer(profile) || inventoryBusy) return;
    setInventoryBusy(true);
    try {
      await dispatchBarangayInventoryItem({
        id: item.id,
        qty: 1,
        byUid: profile.uid,
        byName: profile.displayName?.trim() || profile.email || "Officer",
        note: selected ? `Incident ${selected.id}` : undefined,
      });
    } finally {
      setInventoryBusy(false);
    }
  }

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
      if (investigatorUid && investigatorName) {
        const officer = officers.find((o) => o.uid === investigatorUid);
        const staff =
          APAS_STAFF_SEED.find((s) => s.id === officer?.staffId) ||
          NANGKA_STAFF_SEED.find((s) => s.id === officer?.staffId) ||
          [...APAS_STAFF_SEED, ...NANGKA_STAFF_SEED].find(
            (s) =>
              s.displayName.toLowerCase() ===
              investigatorName.trim().toLowerCase(),
          );
        void triggerInvestigatorNotify({
          report: selected,
          investigatorUid,
          investigatorName,
          phone: staff?.phone ?? null,
          staffId: officer?.staffId ?? staff?.id ?? null,
          email: officer?.email ?? staff?.email ?? null,
        });
      }
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

  function recordPlan() {
    if (!planDraft.trim()) return;
    setPlan({
      notes: planDraft.trim(),
      recordedAt: new Date().toISOString(),
    });
  }

  async function advanceStatus(next: ReportStatus) {
    if (!selected) return;
    setBusy(true);
    try {
      if (next === "legit") {
        await override("legit");
        return;
      }
      if (next === "assigned" && isOfficer(profile) && !selected.investigatorUid) {
        await assignInvestigator(
          profile.uid,
          profile.displayName || profile.email,
        );
        return;
      }
      await updateReportStatus(selected.id, next);
    } finally {
      setBusy(false);
    }
  }

  const pipelineNext: { status: ReportStatus; label: string } | null =
    !selected
      ? null
      : selected.status === "queued" ||
          selected.status === "validating" ||
          selected.status === "needs_review" ||
          selected.status === "failed"
        ? { status: "assigned", label: "Move to assigned" }
        : selected.status === "assigned"
          ? { status: "legit", label: "Mark field-verified" }
          : selected.status === "legit"
            ? { status: "dispatched", label: "Mark dispatched" }
            : selected.status === "dispatched"
              ? { status: "done", label: "Mark done" }
              : null;

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
          href={backHref}
          className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase hover:underline"
        >
          ← Back to board
        </Link>
      </div>
    );
  }

  const reportNeed = parseReportNeed(selected);
  const showResourceShortage =
    reportNeed.short &&
    (selected.status === "legit" ||
      selected.status === "queued" ||
      selected.status === "assigned");

  return (
    <div className="flex flex-col bg-[var(--surface)]">
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <Link
            href={backHref}
            className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--accent)]"
          >
            ← Incidents board
          </Link>
          <p className="shrink-0 text-right font-mono text-[10px] leading-snug tracking-wide text-[var(--muted)] uppercase">
            Received
            <span className="mt-0.5 block normal-case tracking-normal text-[var(--foreground)]">
              {new Date(selected.createdAt).toLocaleString("en-PH", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProfileAvatar
            name={selected.citizenName}
            photoURL={selected.citizenPhotoURL}
            seed={selected.citizenUid || selected.citizenName}
            size="sm"
          />
          <h1 className="text-base font-semibold sm:text-lg">{selected.title}</h1>
          <ReportStatusBadge status={selected.status} />
          <Badge variant="outline">
            {hazardHintLabel(selected.hazardHint)}
          </Badge>
          {plan.recordedAt ? (
            <Badge variant="default">Authorized plan recorded</Badge>
          ) : (
            <Badge variant="warn">No authorized plan</Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {selected.citizenName} · Brgy. {selected.barangay} ·{" "}
          {selected.citizenPurok}
          {selected.locationLabel
            ? ` · ${selected.locationLabel}`
            : " · location pending"}
          {selected.lat != null && selected.lng != null
            ? ` · ${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`
            : ""}
        </p>
        {showResourceShortage ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3 py-2">
            <div className="min-w-0">
              <p className="font-mono text-[9px] tracking-wider text-[var(--warn)] uppercase">
                Resource shortage
              </p>
              <p className="mt-0.5 text-sm text-[var(--foreground)]">
                Local stock cannot cover {reportNeed.neededLabel}.{" "}
                {reportNeed.householdsLabel}.
              </p>
            </div>
            <Link
              href={`/admin/resources/assist?report=${encodeURIComponent(selected.id)}`}
              className="shrink-0 border border-[var(--foreground)] bg-[var(--foreground)] px-3 py-1.5 font-mono text-[10px] tracking-wider text-white uppercase transition hover:opacity-90"
            >
              Find assistance
            </Link>
          </div>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-2">
        <section className="border-b border-[var(--border)] px-4 py-4 sm:px-5 lg:border-r lg:border-b-0">
          <PanelEyebrow>1 · Evidence</PanelEyebrow>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
            Original report
          </h2>

          <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden border border-[var(--border)] bg-[var(--surface-panel)]">
            {selected.mediaUrl?.trim() ? (
              selected.mediaType === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.mediaUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <video
                  src={selected.mediaUrl}
                  className="size-full object-cover"
                  controls
                />
              )
            ) : (
              <p className="text-sm font-medium text-[var(--muted)]">No image</p>
            )}
          </div>

          {(() => {
            const notes = displayReportNotes(selected.notes);
            return notes ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                {notes}
              </p>
            ) : !selected.voiceUrl && !selected.voiceTranscript ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                No written notes attached.
              </p>
            ) : null;
          })()}

          {selected.voiceUrl || selected.voiceTranscript ? (
            <div className="mt-3 space-y-1.5 rounded border border-[var(--border)] bg-[var(--surface-panel)] px-3 py-2.5">
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
                  className="h-9 w-full max-w-md"
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

          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <Meta
              label="AI check"
              value={
                selected.aiReason
                  ? `${
                      selected.aiSource === "gemini"
                        ? "Gemini"
                        : selected.aiSource === "local"
                          ? "local rules"
                          : (selected.aiSource ?? "AI")
                    }${
                      selected.aiConfidence != null
                        ? ` · ${Math.round(selected.aiConfidence * 100)}%`
                        : ""
                    }`
                  : "Pending"
              }
            />
          </dl>

          <div className="mt-3">
            <p className="mb-1.5 font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
              Location
            </p>
            {selected.lat != null && selected.lng != null ? (
              <>
                <HallPinMap
                  center={{ lat: selected.lat, lng: selected.lng }}
                  zoom={16}
                  readOnly
                  className="relative h-[200px] w-full overflow-hidden border border-[var(--border)] sm:h-[240px]"
                />
                <p className="mt-1.5 font-mono text-xs tabular-nums text-[var(--foreground)]">
                  {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                  {selected.locationAccuracyM != null
                    ? ` · ±${Math.round(selected.locationAccuracyM)} m`
                    : ""}
                </p>
                {selected.locationLabel ? (
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    {selected.locationLabel}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 font-mono text-xs text-[var(--muted)]">
                Coordinates not provided
              </div>
            )}
          </div>

          <TrustMeter
            score={selected.trustScore}
            breakdown={selected.trustBreakdown}
          />

          {selected.aiReason ? (
            <div className="mt-3 border border-dashed border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2">
              <p className="font-mono text-[9px] tracking-wider text-[var(--warn)] uppercase">
                AI interpretation · proposal only
              </p>
              <p className="mt-1 text-sm">{selected.aiReason}</p>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
              Related reports
            </p>
            {related.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                No related reports in this barangay yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`${backHref}/${encodeURIComponent(r.id)}`}
                      className="block w-full border border-[var(--border)] px-2.5 py-2 text-left text-xs transition hover:border-[var(--accent)]"
                    >
                      <span className="font-medium">{r.title}</span>
                      <span className="mt-0.5 block text-[var(--muted)]">
                        {r.citizenName} · {hazardHintLabel(r.hazardHint)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="px-4 py-4 sm:px-5">
          <PanelEyebrow>2 · Decision</PanelEyebrow>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
            Verify &amp; allocate
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Human verification required before any response is authorized.
          </p>

          <div className="mt-3 space-y-2">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
              Assign investigator
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="min-w-[12rem] flex-1">
                <span className="sr-only">Who will investigate</span>
                <select
                  value={selected.investigatorUid ?? ""}
                  disabled={busy}
                  aria-label="Assign who will investigate"
                  onChange={(e) => {
                    const uid = e.target.value || null;
                    if (!uid) {
                      void assignInvestigator(null, null);
                      return;
                    }
                    const officer = officers.find((o) => o.uid === uid);
                    void assignInvestigator(
                      uid,
                      officer?.displayName || officer?.email || uid,
                    );
                  }}
                  className="w-full border border-[var(--border)] bg-[var(--input)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-50"
                >
                  <option value="">Unassigned</option>
                  {officers.map((o) => (
                    <option key={o.uid} value={o.uid}>
                      {o.displayName || o.email}
                      {o.officerTitle ? ` · ${o.officerTitle}` : ""}
                    </option>
                  ))}
                  {selected.investigatorUid &&
                  !officers.some((o) => o.uid === selected.investigatorUid) ? (
                    <option value={selected.investigatorUid}>
                      {selected.investigatorName || selected.investigatorUid}
                    </option>
                  ) : null}
                </select>
              </label>
              {isOfficer(profile) && !selected.investigatorUid ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void assignInvestigator(
                      profile.uid,
                      profile.displayName || profile.email,
                    )
                  }
                >
                  Assign me
                </Button>
              ) : null}
            </div>
            {selected.investigatorName ? (
              <p className="text-xs text-[var(--muted)]">
                Investigating · {selected.investigatorName}
                {selected.investigatedAt
                  ? ` · assigned ${new Date(selected.investigatedAt).toLocaleString()}`
                  : ""}
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                Pick an officer who will investigate this incident.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {pipelineNext ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void advanceStatus(pipelineNext.status)}
              >
                {pipelineNext.label}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                busy ||
                selected.status === "rejected" ||
                selected.status === "done"
              }
              onClick={() => void override("rejected")}
            >
              Reject report
            </Button>
          </div>

          <div className="mt-4">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
              Unknowns
            </p>
            {unknowns.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                No critical unknowns flagged from this report.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {unknowns.map((u) => (
                  <li
                    key={u.id}
                    className="border-l-2 border-[var(--warn)] bg-[var(--surface-raised)] px-3 py-2"
                  >
                    <p className="text-sm font-medium">{u.label}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {u.detail}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--warn)] uppercase">
              Recommended next actions · AI proposal
            </p>
            <ul className="mt-2 space-y-2">
              {proposals.map((p) => (
                <li
                  key={p.id}
                  className={cn(
                    "flex gap-2.5 border border-[var(--border)] px-3 py-2",
                    p.done && "border-[var(--accent)]/35 bg-[var(--accent)]/5",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(p.done)}
                    disabled={busy || !p.manual}
                    readOnly={!p.manual}
                    tabIndex={p.manual ? 0 : -1}
                    aria-label={
                      p.manual
                        ? p.label
                        : p.done
                          ? `${p.label} (done)`
                          : p.label
                    }
                    onChange={
                      p.manual
                        ? (e) => {
                            void (async () => {
                              setBusy(true);
                              try {
                                await setReportManualDispatchChecked(
                                  selected.id,
                                  e.target.checked,
                                );
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }
                        : undefined
                    }
                    className="mt-0.5 size-3.5 shrink-0 accent-[var(--accent)] disabled:opacity-100"
                  />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        p.done && "text-[var(--muted)] line-through",
                      )}
                    >
                      {p.label}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {p.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--warn)] uppercase">
                Suggested inventory · barangay stock
              </p>
              <Link
                href="/admin/inventory"
                className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase hover:underline"
              >
                Open inventory
              </Link>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Matched to {hazardHintLabel(selected.hazardHint)}. Proposal only.
              Confirm before dispatch.
            </p>
            {inventorySuggestions.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                No matching barangay inventory yet. Add stock under Databases →
                Inventory.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {inventorySuggestions.map(({ item, short }) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 border border-[var(--border)] px-3 py-2"
                  >
                    <div className="relative h-12 w-16 shrink-0 overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)]">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.label}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {short
                          ? "Short / unavailable locally"
                          : `${item.available} ${item.unit} on hand`}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--foreground)]">
                        Stored at{" "}
                        {item.location?.trim() || "Location TBD"}
                      </p>
                    </div>
                    {short ? (
                      <Link
                        href={`/admin/resources/assist?report=${encodeURIComponent(selected.id)}`}
                        className="shrink-0 border border-[var(--border)] px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase transition hover:border-[var(--accent)]"
                      >
                        Find assistance
                      </Link>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={inventoryBusy || busy}
                        onClick={() => void dispatchSuggestedStock(item)}
                      >
                        Dispatch 1
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 border border-[var(--border)] bg-[var(--surface-raised)] p-3">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--accent)] uppercase">
              Authorized response plan
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Edit the draft, then record. This is the human-approved plan,
              distinct from AI proposals above.
            </p>
            <textarea
              value={planDraft}
              onChange={(e) => setPlanDraft(e.target.value)}
              rows={3}
              placeholder="e.g. Contact reporter · assign 1 BRTS for eyes-on · hold boat until location confirmed…"
              className="mt-2 w-full resize-y border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!planDraft.trim()}
                onClick={recordPlan}
              >
                Record final plan
              </Button>
              {plan.recordedAt ? (
                <span className="text-[11px] text-[var(--muted)]">
                  Recorded {new Date(plan.recordedAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <section className="border-t border-[var(--border)] px-4 py-4 sm:px-5">
        <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
          Field photos
        </p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Upload images of what is happening on site. Images only.
        </p>
        <label className="mt-2 block">
          <span className="sr-only">Upload field photos</span>
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            disabled={busy || !isOfficer(profile)}
            onChange={(e) => {
              const list = e.target.files;
              if (!list?.length || !profile || !isOfficer(profile)) return;
              const files = Array.from(list).filter((f) =>
                f.type.startsWith("image/"),
              );
              e.target.value = "";
              if (!files.length) return;
              void (async () => {
                setBusy(true);
                try {
                  await addReportFieldEvidence({
                    reportId: selected.id,
                    uploaderUid: profile.uid,
                    uploaderName:
                      profile.displayName || profile.email || null,
                    files,
                  });
                } catch (err) {
                  console.error(err);
                } finally {
                  setBusy(false);
                }
              })();
            }}
            className="block w-full text-sm text-[var(--muted)] file:mr-3 file:border file:border-[var(--border)] file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--fg)] disabled:opacity-50"
          />
        </label>
        {selected.fieldEvidence?.length ? (
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {selected.fieldEvidence.map((img) => (
              <li
                key={img.mediaPath}
                className="overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.mediaUrl}
                  alt="Field evidence"
                  className="aspect-[4/3] w-full object-cover"
                />
                {img.uploadedByName ? (
                  <p className="truncate px-2 py-1 text-[10px] text-[var(--muted)]">
                    {img.uploadedByName}
                    {img.uploadedAt
                      ? ` · ${new Date(img.uploadedAt).toLocaleString()}`
                      : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-[var(--muted)]">No field photos yet.</p>
        )}
      </section>

      <section className="border-t border-[var(--border)]">
        <button
          type="button"
          onClick={() => setActivityOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left sm:px-5"
        >
          <div>
            <PanelEyebrow>3 · Activity</PanelEyebrow>
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Timeline
            </h2>
          </div>
          <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
            {activityOpen ? "Collapse" : "Expand"}
          </span>
        </button>
        {activityOpen ? (
          <ol className="space-y-0 border-t border-[var(--border)] px-4 pb-5 sm:px-5">
            {activity.map((e, i) => (
              <li
                key={e.id}
                className="relative flex gap-3 border-l border-[var(--border)] py-3 pl-4"
              >
                <span
                  className={cn(
                    "absolute top-4 -left-1.5 size-3 rounded-full border-2 border-[var(--surface)]",
                    e.kind === "ai" && "bg-[var(--warn)]",
                    e.kind === "human" && "bg-[var(--accent)]",
                    e.kind === "citizen" && "bg-[var(--foreground)]",
                    e.kind === "system" && "bg-[var(--muted)]",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-medium">{e.title}</p>
                    <time className="font-mono text-[10px] text-[var(--muted)]">
                      {new Date(e.at).toLocaleString()}
                    </time>
                  </div>
                  {e.detail ? (
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {e.detail}
                    </p>
                  ) : null}
                  {i === activity.length - 1 && plan.recordedAt ? (
                    <p className="mt-2 text-xs text-[var(--accent)]">
                      Authorized plan: {plan.notes}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  );
}

function PanelEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
      {children}
    </p>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2">
      <dt className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function TrustMeter({
  score,
  breakdown,
}: {
  score: number | null;
  breakdown: ReportTrustBreakdown | null;
}) {
  const total = score ?? 0;
  const slices = [
    {
      key: "ID",
      value: breakdown?.identity ?? 0,
      cap: TRUST_CAPS.identity,
    },
    {
      key: "Contact",
      value: breakdown?.contact ?? 0,
      cap: TRUST_CAPS.contact,
    },
    {
      key: "Allow location · Mobile camera",
      value: breakdown?.capture ?? 0,
      cap: TRUST_CAPS.capture,
    },
    {
      key: "AI",
      value: breakdown?.ai ?? 0,
      cap: TRUST_CAPS.ai,
    },
  ] as const;

  const tone =
    score == null
      ? "bg-[var(--border)]"
      : total >= 80
        ? "bg-[var(--success)]"
        : total >= 55
          ? "bg-[#2563eb]"
          : total >= 30
            ? "bg-[var(--warn)]"
            : "bg-[var(--danger)]";

  return (
    <div className="mt-3 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
            Trust meter
          </p>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {score == null ? "Not scored yet" : trustLabel(total)}
          </p>
        </div>
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums tracking-wide">
          {score == null ? "—" : `${total}%`}
        </p>
      </div>

      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--border)]/70"
        role="meter"
        aria-label="Trust score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score ?? 0}
      >
        <div
          className={cn("h-full rounded-full transition-[width]", tone)}
          style={{ width: `${Math.min(100, Math.max(0, total))}%` }}
        />
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {slices.map((s) => {
          const pct = s.cap > 0 ? Math.round((s.value / s.cap) * 100) : 0;
          return (
            <li key={s.key} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium text-[var(--foreground)]">
                  {s.key}
                </span>
                <span className="font-mono tabular-nums text-[var(--muted)]">
                  {s.value}/{s.cap}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--border)]/70">
                <div
                  className="h-full rounded-full bg-[var(--foreground)]/70"
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
