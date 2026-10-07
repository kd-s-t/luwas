"use client";

import { useEffect, useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { subscribeAllReports, updateReportValidation } from "@/lib/reports/api";
import type { HazardReport } from "@/lib/reports/types";

type Filter = "queue" | "all" | "legit" | "rejected";

export function ValidationQueue() {
  const [rows, setRows] = useState<HazardReport[]>([]);
  const [filter, setFilter] = useState<Filter>("queue");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeAllReports(setRows);
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "legit") return rows.filter((r) => r.status === "legit");
    if (filter === "rejected") return rows.filter((r) => r.status === "rejected");
    return rows.filter((r) =>
      ["queued", "validating", "needs_review", "failed"].includes(r.status),
    );
  }, [rows, filter]);

  const queueCount = rows.filter((r) =>
    ["queued", "validating", "needs_review", "failed"].includes(r.status),
  ).length;

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
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)]">
      <div className="flex flex-col gap-2 border-b border-[var(--border)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <div>
          <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
            AI validation queue
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
            Citizen field reports
          </h2>
          <p className="text-xs text-[var(--muted)]">
            {queueCount} awaiting review · Gemini screens uploads before they
            count as verified hazards
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
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
              className={`border px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase ${
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

      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-sm text-[var(--muted)]">
          No reports in this view. Citizens submit from /login/citizen.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {filtered.map((r) => (
            <li
              key={r.id}
              className="grid gap-3 px-3 py-3 sm:grid-cols-[120px_1fr_auto] sm:px-4"
            >
              <div className="aspect-video overflow-hidden border border-[var(--border)] bg-[var(--surface-panel)] sm:aspect-square">
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
                <div className="flex flex-wrap items-center gap-2">
                  <ProfileAvatar
                    name={r.citizenName}
                    photoURL={r.citizenPhotoURL}
                    size="sm"
                  />
                  <p className="font-medium">{r.title}</p>
                  <ReportStatusBadge status={r.status} />
                  {r.aiSource ? (
                    <Badge variant="outline">via {r.aiSource}</Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {r.citizenName} · {r.citizenPurok} · {r.hazardHint} ·{" "}
                  {new Date(r.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-[var(--foreground)]">{r.notes}</p>
                {r.aiReason ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    AI{r.aiConfidence != null
                      ? ` (${Math.round(r.aiConfidence * 100)}%)`
                      : ""}
                    : {r.aiReason}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-row gap-2 sm:flex-col">
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === r.id || r.status === "legit"}
                  onClick={() => override(r, "legit")}
                >
                  Mark verified
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
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
