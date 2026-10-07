"use client";

import { useEffect, useState } from "react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { subscribeCitizenReports } from "@/lib/reports/api";
import type { HazardReport } from "@/lib/reports/types";

export function CitizenReportsList({ citizenUid }: { citizenUid: string }) {
  const [rows, setRows] = useState<HazardReport[]>([]);

  useEffect(() => {
    return subscribeCitizenReports(citizenUid, setRows);
  }, [citizenUid]);

  return (
    <section className="border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
          Your reports
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
          Queue status
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-[var(--muted)]">
          No reports yet. Submit a photo or video of what’s happening.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((r) => (
            <li key={r.id} className="flex gap-3 px-4 py-3">
              <ProfileAvatar
                name={r.citizenName}
                photoURL={r.citizenPhotoURL}
                size="md"
              />
              <div className="size-16 shrink-0 overflow-hidden border border-[var(--border)] bg-[var(--surface-panel)]">
                {r.mediaType === "photo" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.mediaUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <video src={r.mediaUrl} className="size-full object-cover" muted />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{r.title}</p>
                  <ReportStatusBadge status={r.status} />
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {r.hazardHint} · {new Date(r.createdAt).toLocaleString()}
                </p>
                {r.aiReason ? (
                  <p className="mt-1 text-xs text-[var(--muted)]">{r.aiReason}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
