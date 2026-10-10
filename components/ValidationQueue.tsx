"use client";

import { Info } from "lucide-react";
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
import { subscribeAllReports, updateReportValidation } from "@/lib/reports/api";
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

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

type Filter = "queue" | "all" | "legit" | "rejected";

export function ValidationQueue() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<HazardReport[]>([]);
  const [filter, setFilter] = useState<Filter>("queue");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [here, setHere] = useState<LatLng | null>(null);
  const [hereLabel, setHereLabel] = useState("Brgy. hall");

  const scope = useMemo(() => scopeForProfile(profile), [profile]);
  const anchor = useMemo(() => here ?? scopeAnchor(scope), [here, scope]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
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

  const mix = useMemo(() => {
    const total = scoped.length;
    const verified = scoped.filter((r) => r.status === "legit").length;
    const rejected = scoped.filter((r) => r.status === "rejected").length;
    const queue = scoped.filter((r) =>
      ["queued", "validating", "needs_review", "failed"].includes(r.status),
    ).length;
    return {
      total,
      verified,
      rejected,
      queue,
      verifiedPct: pct(verified, total),
      rejectedPct: pct(rejected, total),
      queuePct: pct(queue, total),
    };
  }, [scoped]);

  async function override(
    report: HazardReport,
    verdict: "legit" | "rejected",
  ) {
    setBusyId(report.id);
    try {
      await updateReportValidation(report.id, {
        status: verdict,
        aiVerdict: verdict,
        aiConfidence: report.aiConfidence ?? 1,
        aiReason: `Officer override → ${verdict}. ${report.aiReason ?? ""}`.trim(),
        aiSource: report.aiSource,
        aiModel: report.aiModel,
        validatedAt: new Date().toISOString(),
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
    } finally {
      setBusyId(null);
    }
  }

  const orgHint = isOfficer(profile) ? profile.orgName : null;

  return (
    <section className="overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)]">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-4 sm:py-2.5">
        <div className="min-w-0">
          <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
            AI validation queue
          </p>
          <div className="flex items-center gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide sm:text-xl">
              Citizen field reports
            </h2>
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex size-7 shrink-0 items-center justify-center border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  aria-label="Trust score and queue percentages"
                >
                  <Info className="size-3.5" strokeWidth={2} />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Trust & queue percentages</DialogTitle>
                  <DialogDescription>
                    How Trust % is scored, plus the live mix for{" "}
                    {scopeLabel(scope)}.
                  </DialogDescription>
                </DialogHeader>
                <DialogBody className="space-y-5">
                  <div>
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
                            "AI",
                            TRUST_CAPS.ai,
                            "Model confidence after validation",
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
                  </div>

                  <div>
                    <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
                      This barangay · {mix.total} reports
                    </p>
                    <ul className="mt-2 space-y-2 text-sm">
                      {(
                        [
                          ["Awaiting review", mix.queue, mix.queuePct],
                          ["Verified", mix.verified, mix.verifiedPct],
                          ["Rejected", mix.rejected, mix.rejectedPct],
                        ] as const
                      ).map(([label, count, share]) => (
                        <li
                          key={label}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="text-[var(--muted)]">{label}</span>
                          <span className="font-mono text-xs tabular-nums">
                            {count} · {share}%
                          </span>
                        </li>
                      ))}
                    </ul>
                    {mix.total > 0 ? (
                      <div className="mt-3 flex h-2 overflow-hidden border border-[var(--border)]">
                        <div
                          className="bg-[var(--warn)]"
                          style={{ width: `${mix.queuePct}%` }}
                          title={`Queue ${mix.queuePct}%`}
                        />
                        <div
                          className="bg-[var(--accent)]"
                          style={{ width: `${mix.verifiedPct}%` }}
                          title={`Verified ${mix.verifiedPct}%`}
                        />
                        <div
                          className="bg-[var(--muted)]/40"
                          style={{ width: `${mix.rejectedPct}%` }}
                          title={`Rejected ${mix.rejectedPct}%`}
                        />
                      </div>
                    ) : null}
                  </div>
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
                {r.trustBreakdown ? (
                  <p className="mt-1.5 hidden font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase sm:block">
                    {formatTrustBreakdown(r.trustBreakdown)}
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
