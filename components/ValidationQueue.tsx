"use client";

import { Download, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import type { LatLng } from "@/lib/geo/cebu";
import { triggerAutoResponderCall } from "@/lib/alerts/autoResponderCall";
import { subscribeAllReports, updateReportValidation } from "@/lib/reports/api";
import { syncHazardReportToBigQuery } from "@/lib/reports/bigquerySync";
import {
  formatDistanceKm,
  reportInScope,
  scopeAnchor,
  scopeForProfile,
  scopeLabel,
  sortReportsByDistance,
} from "@/lib/reports/barangayScope";
import { captureReportMeta } from "@/lib/reports/captureMeta";
import { ensureQueueSampleReports } from "@/lib/reports/ensureQueueSampleReports";
import { ensureAllMapReportsInDb } from "@/lib/reports/seedMapReport";
import {
  formatTrustBreakdown,
  TRUST_CAPS,
  trustLabel,
} from "@/lib/reports/trustScore";
import type { HazardReport } from "@/lib/reports/types";
import {
  downloadVertexMonthZip,
  formatMonthLabel,
  listVertexBatchMonths,
  monthKey,
  reportsForVertexMonthBatch,
} from "@/lib/reports/vertexExport";

type Filter = "queue" | "all" | "legit" | "rejected";

export function ValidationQueue() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<HazardReport[]>([]);
  const [filter, setFilter] = useState<Filter>("queue");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [exportMonth, setExportMonth] = useState(monthKey());
  const [here, setHere] = useState<LatLng | null>(null);
  const [hereLabel, setHereLabel] = useState("Brgy. hall");

  const scope = useMemo(() => scopeForProfile(profile), [profile]);
  const anchor = useMemo(() => here ?? scopeAnchor(scope), [here, scope]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const { isSimulationOn } = await import("@/lib/config/simulation");
      if (isSimulationOn()) {
        try {
          await ensureAllMapReportsInDb();
        } catch (err) {
          console.warn("Map report seed failed", err);
        }
        try {
          await ensureQueueSampleReports();
        } catch (err) {
          console.warn("Queue sample seed failed", err);
        }
      }
      if (cancelled) return;
      unsub = subscribeAllReports(setRows);
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
        setHereLabel("Your location");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const scoped = useMemo(
    () => rows.filter((r) => reportInScope(r, scope)),
    [rows, scope],
  );

  const filtered = useMemo(() => {
    if (filter === "all") return scoped;
    if (filter === "legit") return scoped.filter((r) => r.status === "legit");
    if (filter === "rejected")
      return scoped.filter((r) => r.status === "rejected");
    return scoped.filter((r) =>
      ["queued", "validating", "needs_review", "failed"].includes(r.status),
    );
  }, [scoped, filter]);

  const ranked = useMemo(
    () => sortReportsByDistance(filtered, anchor),
    [filtered, anchor],
  );

  const queueCount = scoped.filter((r) =>
    ["queued", "validating", "needs_review", "failed"].includes(r.status),
  ).length;

  async function override(
    report: HazardReport,
    verdict: "legit" | "rejected",
  ) {
    setBusyId(report.id);
    try {
      const validatedAt = new Date().toISOString();
      await updateReportValidation(report.id, {
        status: verdict,
        aiVerdict: verdict,
        aiConfidence: report.aiConfidence ?? 1,
        aiReason: `Officer override → ${verdict}. ${report.aiReason ?? ""}`.trim(),
        aiSource: report.aiSource,
        aiModel: report.aiModel,
        validatedAt,
        trustInput: {
          registered: Boolean(report.citizenUid),
          idVerified: report.reporterIdVerified,
          email: report.reporterEmail,
          phone: report.reporterPhone,
          emailVerified: report.reporterEmailVerified,
          mediaSource: report.mediaSource,
          lat: report.lat,
          lng: report.lng,
          locationAccuracyM: report.locationAccuracyM,
        },
      });
      syncHazardReportToBigQuery({
        ...report,
        status: verdict,
        aiVerdict: verdict,
        validatedAt,
      });
      if (verdict === "legit") {
        void triggerAutoResponderCall({
          ...report,
          status: "legit",
          autoResponderCallAt: report.autoResponderCallAt ?? null,
        });
      }
    } finally {
      setBusyId(null);
    }
  }

  const orgHint = isOfficer(profile) ? profile.orgName : null;
  const vertexMonths = useMemo(
    () => listVertexBatchMonths(scoped),
    [scoped],
  );

  useEffect(() => {
    if (vertexMonths.length === 0) return;
    if (vertexMonths.some((m) => m.ym === exportMonth)) return;
    const current = monthKey();
    const pick =
      vertexMonths.find((m) => m.ym === current)?.ym ?? vertexMonths[0]!.ym;
    setExportMonth(pick);
  }, [vertexMonths, exportMonth]);

  const monthBatchCount = useMemo(
    () => reportsForVertexMonthBatch(scoped, exportMonth).length,
    [scoped, exportMonth],
  );

  async function exportVertexMonth() {
    setExporting(true);
    setExportNote(null);
    try {
      const { count, fileName } = await downloadVertexMonthZip(scoped, {
        monthYm: exportMonth,
      });
      setExportNote(`Downloaded ${fileName} · ${count} images`);
    } catch (err) {
      setExportNote(
        err instanceof Error ? err.message : "Vertex export failed",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)]">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-4 sm:py-2.5">
        <div className="min-w-0">
          <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
            AI validation queue
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide sm:text-xl">
              Citizen field reports
            </h2>
            <label className="inline-flex items-center gap-1.5">
              <span className="sr-only">Vertex batch month</span>
              <select
                value={exportMonth}
                onChange={(e) => setExportMonth(e.target.value)}
                disabled={exporting || vertexMonths.length === 0}
                className="h-8 border border-[var(--border)] bg-[var(--surface)] px-2 font-mono text-[10px] tracking-wider text-[var(--foreground)] uppercase outline-none focus:border-[var(--accent)] disabled:opacity-50"
                title="Month to pack for Vertex"
              >
                {vertexMonths.length === 0 ? (
                  <option value={exportMonth}>No photos</option>
                ) : (
                  vertexMonths.map((m) => (
                    <option key={m.ym} value={m.ym}>
                      {formatMonthLabel(m.ym)} · {m.count}
                    </option>
                  ))
                )}
              </select>
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={exporting || monthBatchCount === 0}
              onClick={() => void exportVertexMonth()}
              title={`Zip + CSV for Vertex dataset luwas-vision-v1 (${formatMonthLabel(exportMonth)})`}
            >
              <Download className="size-3.5" strokeWidth={2} />
              {exporting
                ? "Packing…"
                : `Vertex batch · ${monthBatchCount}`}
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-7 shrink-0 items-center justify-center border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  aria-label="Trust score percentages"
                >
                  <Info className="size-3.5" strokeWidth={2} />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Trust percentages</DialogTitle>
                  <DialogDescription>
                    How Trust % is scored for each report.
                  </DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
                    Trust stack · max 100
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {(
                      [
                        [
                          "Identity",
                          TRUST_CAPS.identity,
                          "Registered account + ID verified",
                        ],
                        [
                          "Contact",
                          TRUST_CAPS.contact,
                          "Usable email + phone",
                        ],
                        [
                          "Capture",
                          TRUST_CAPS.capture,
                          "Mobile camera + tight GPS",
                        ],
                        [
                          "Vertex AI",
                          TRUST_CAPS.ai,
                          "Gemini confidence after validation",
                        ],
                      ] as const
                    ).map(([label, cap, hint]) => (
                      <li
                        key={label}
                        className="flex items-baseline justify-between gap-3 border-b border-[var(--border)]/70 pb-2 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{label}</p>
                          <p className="text-xs text-[var(--muted)]">{hint}</p>
                        </div>
                        <p className="shrink-0 font-mono text-sm tabular-nums text-[var(--accent)]">
                          {cap}%
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    High ≥80 · Moderate ≥55 · Low ≥30 · else Untrusted
                  </p>
                </DialogBody>
              </DialogContent>
            </Dialog>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">
            <span className="text-[var(--foreground)]">
              {queueCount} awaiting review
            </span>
            <span className="hidden sm:inline">
              {" "}
              · showing {scopeLabel(scope)} only · nearest first ({hereLabel})
              {orgHint ? ` · ${orgHint}` : ""}
            </span>
          </p>
          {exportNote ? (
            <p className="mt-1 text-[11px] text-[var(--muted)]">{exportNote}</p>
          ) : (
            <p className="mt-1 hidden text-[11px] text-[var(--muted)] sm:block">
              Vertex batch = pick a month → zip + labels.csv for luwas-vision-v1
            </p>
          )}
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted)] sm:hidden">
            {scopeLabel(scope)} · nearest first
          </p>
        </div>
        <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
          {(
            [
              ["queue", "Queue"],
              ["legit", "Verified"],
              ["rejected", "Rejected"],
              ["all", "All"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`shrink-0 border px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase sm:px-2.5 sm:py-1 ${
                filter === id
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                  : "border-[var(--border)] text-[var(--muted)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {ranked.length === 0 ? (
        <p className="px-4 py-8 text-sm text-[var(--muted)]">
          No reports for {scopeLabel(scope)} in this view.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {ranked.map(({ report: r, distanceKm }) => (
            <li
              key={r.id}
              className="grid grid-cols-1 gap-3 px-3 py-3 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:items-start sm:px-4"
            >
              <div className="aspect-[16/10] overflow-hidden border border-[var(--border)] bg-[var(--surface-panel)] sm:aspect-square">
                {r.mediaType === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.mediaUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <video
                    src={r.mediaUrl}
                    className="size-full object-cover"
                    controls
                    muted
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <ProfileAvatar
                    name={r.citizenName}
                    photoURL={r.citizenPhotoURL}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug break-words sm:text-base">
                      {r.title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <ReportStatusBadge status={r.status} />
                      <Badge variant="outline">
                        {formatDistanceKm(distanceKm)}
                      </Badge>
                      {r.aiSource ? (
                        <Badge variant="outline">via {r.aiSource}</Badge>
                      ) : null}
                      {r.trustScore != null ? (
                        <Badge
                          variant="outline"
                          title={
                            r.trustBreakdown
                              ? formatTrustBreakdown(r.trustBreakdown)
                              : undefined
                          }
                        >
                          Trust {r.trustScore}% · {trustLabel(r.trustScore)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[var(--muted)] break-words">
                  <span className="sm:hidden">
                    {r.citizenName} · {r.hazardHint} ·{" "}
                    {new Date(r.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="hidden sm:inline">
                    {r.citizenName} · Brgy. {r.barangay} · {r.citizenPurok} ·{" "}
                    {r.hazardHint} · {new Date(r.createdAt).toLocaleString()}
                  </span>
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--foreground)] break-words">
                  {r.notes}
                </p>
                {r.voiceUrl || r.voiceTranscript ? (
                  <div className="mt-2 space-y-1.5 rounded border border-[var(--border)] bg-[var(--surface-panel)] px-2.5 py-2">
                    <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                      Voice note
                      {r.voiceNoteLabel ? ` · ${r.voiceNoteLabel}` : ""}
                    </p>
                    {r.voiceUrl ? (
                      <audio
                        controls
                        preload="metadata"
                        src={r.voiceUrl}
                        className="h-8 w-full max-w-md"
                      >
                        <track kind="captions" />
                      </audio>
                    ) : null}
                    {r.voiceTranscript ? (
                      <p className="text-sm leading-relaxed break-words">
                        {r.voiceTranscript}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {r.trustBreakdown ? (
                  <p className="mt-1.5 hidden font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase sm:block">
                    {formatTrustBreakdown(r.trustBreakdown)}
                  </p>
                ) : null}
                {r.vertexClass ? (
                  <p className="mt-1 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
                    Vertex · {r.vertexClass}
                    {r.vertexConfidence != null
                      ? ` · ${Math.round(r.vertexConfidence * 100)}%`
                      : ""}
                  </p>
                ) : null}
                {r.aiReason ? (
                  <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] break-words">
                    AI
                    {r.aiConfidence != null
                      ? ` (${Math.round(r.aiConfidence * 100)}%)`
                      : ""}
                    : {r.aiReason}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:w-[8.5rem] sm:flex-col">
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={busyId === r.id || r.status === "legit"}
                  onClick={() => override(r, "legit")}
                >
                  Mark verified
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={busyId === r.id || r.status === "rejected"}
                  onClick={() => override(r, "rejected")}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
