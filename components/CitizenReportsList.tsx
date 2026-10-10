"use client";

import { useEffect, useRef, useState } from "react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen } from "@/lib/auth/types";
import { subscribeCitizenReports } from "@/lib/reports/api";
import { ensureMySampleReports } from "@/lib/reports/ensureMySampleReports";
import type { HazardReport } from "@/lib/reports/types";

export function CitizenReportsList({ citizenUid }: { citizenUid: string }) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<HazardReport[]>([]);
  const seeded = useRef(false);

  useEffect(() => {
    if (!citizenUid || !profile || profile.uid !== citizenUid) return;
    if (seeded.current) return;
    seeded.current = true;
    void ensureMySampleReports({
      uid: profile.uid,
      displayName: profile.displayName,
      purok: isCitizen(profile) ? profile.purok : "Purok 6",
      email: profile.email,
      phone: isCitizen(profile) ? profile.phone : null,
      photoURL: profile.photoURL,
      idVerified: profile.idVerified,
    }).catch((err) => {
      seeded.current = false;
      console.warn("My reports sample seed failed", err);
    });
  }, [citizenUid, profile]);

  useEffect(() => {
    return subscribeCitizenReports(citizenUid, setRows);
  }, [citizenUid]);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
            Your reports
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
            Queue
          </h2>
        </div>
        <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
          {rows.length} {rows.length === 1 ? "post" : "posts"}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="border-t border-[var(--border)]/70 pt-4 text-sm text-[var(--muted)]">
          Nothing in the queue yet. Send a report above when something’s
          happening.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]/70 border-t border-[var(--border)]/70">
          {rows.map((r) => (
            <li key={r.id} className="flex gap-3 py-3.5">
              <ProfileAvatar
                name={r.citizenName}
                photoURL={r.citizenPhotoURL}
                size="md"
              />
              <div className="size-14 shrink-0 overflow-hidden bg-[var(--surface-panel)] sm:size-16">
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
                    muted
                  />
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
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
                    {r.aiReason}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
