"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import {
  officerScopeBarangay,
  subscribeBarangayUsers,
} from "@/lib/auth/accountValidation";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isAccountActive,
  isOfficer,
  type OfficerProfile,
} from "@/lib/auth/types";
import { subscribeAllReports } from "@/lib/reports/api";
import {
  reportInScope,
  scopeAnchor,
  scopeForProfile,
  scopeLabel,
  sortReportsByDistance,
} from "@/lib/reports/barangayScope";
import { ensureAllMapReportsInDb } from "@/lib/reports/seedMapReport";
import {
  hazardHintLabel,
  type HazardReport,
  type ReportStatus,
} from "@/lib/reports/types";
import { useScenario } from "@/lib/scenarios";
import { cn } from "@/lib/utils";

const REVIEW_STATUSES = new Set<ReportStatus>([
  "queued",
  "validating",
  "needs_review",
  "failed",
]);

type BoardColumn = {
  id: "review" | "verified" | "rejected";
  label: string;
  match: (r: HazardReport) => boolean;
};

const COLUMNS: BoardColumn[] = [
  {
    id: "review",
    label: "Needs review",
    match: (r) => REVIEW_STATUSES.has(r.status),
  },
  {
    id: "verified",
    label: "Verified",
    match: (r) => r.status === "legit",
  },
  {
    id: "rejected",
    label: "Rejected",
    match: (r) => r.status === "rejected",
  },
];

export function IncidentBoard() {
  const { profile } = useAuth();
  const { officerBundle } = useScenario();
  const [rows, setRows] = useState<HazardReport[]>([]);
  const [officers, setOfficers] = useState<OfficerProfile[]>([]);

  const scope = useMemo(() => scopeForProfile(profile), [profile]);
  const barangay = isOfficer(profile) ? officerScopeBarangay(profile) : "";
  const areaId = isOfficer(profile)
    ? profile.areaId ?? profile.activeBarangayId
    : null;

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        await ensureAllMapReportsInDb();
      } catch (err) {
        console.warn("Map report seed failed", err);
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
    if (!isOfficer(profile) || !isAccountActive(profile) || !barangay) {
      setOfficers([]);
      return;
    }
    return subscribeBarangayUsers(
      barangay,
      (users) => {
        setOfficers(
          users.filter(
            (u): u is OfficerProfile => isOfficer(u) && isAccountActive(u),
          ),
        );
      },
      undefined,
      areaId,
    );
  }, [profile, barangay, areaId]);

  const officerByUid = useMemo(() => {
    const map = new Map<string, OfficerProfile>();
    for (const o of officers) map.set(o.uid, o);
    return map;
  }, [officers]);

  const ranked = useMemo(() => {
    const scoped = rows.filter((r) => reportInScope(r, scope));
    return sortReportsByDistance(scoped, scopeAnchor(scope)).map(
      (x) => x.report,
    );
  }, [rows, scope]);

  const queueCount = ranked.filter((r) => REVIEW_STATUSES.has(r.status)).length;
  const orgHint = isOfficer(profile) ? profile.orgName : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--surface)]">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-raised)]/90 px-4 py-3 sm:px-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
            Incidents
          </p>
          <Link
            href="/overview"
            className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--accent)]"
          >
            ← Overview
          </Link>
        </div>
        <div className="mt-0.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide sm:text-2xl">
              {officerBundle.shortLabel} · {scopeLabel(scope)}
            </h1>
            <p className="text-xs text-[var(--muted)]">
              {queueCount} awaiting review · open a card for evidence &amp;
              decision
              {orgHint ? ` · ${orgHint}` : ""}
            </p>
          </div>
          <p className="max-w-sm text-right text-[11px] text-[var(--muted)]">
            AI proposals are not authorized plans. Verify before allocating aid.
          </p>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
            No field reports in scope yet
          </p>
          <p className="max-w-md text-sm text-[var(--muted)]">
            When citizens or relay channels post reports for {scopeLabel(scope)},
            they appear on this board.
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-x-auto px-3 py-3 sm:grid-cols-3 sm:px-4 sm:py-4">
          {COLUMNS.map((col) => {
            const cards = ranked.filter(col.match);
            return (
              <section
                key={col.id}
                className="flex min-h-0 min-w-0 flex-col rounded-lg border border-[var(--border)] bg-[var(--surface-panel)]/40"
              >
                <header className="flex shrink-0 items-baseline justify-between gap-2 border-b border-[var(--border)] px-3 py-2.5">
                  <h2 className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
                    {col.label}
                  </h2>
                  <span className="font-mono text-[10px] tabular-nums text-[var(--foreground)]">
                    {cards.length}
                  </span>
                </header>
                <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                  {cards.length === 0 ? (
                    <li className="px-2 py-6 text-center text-xs text-[var(--muted)]">
                      No cards
                    </li>
                  ) : (
                    cards.map((r) => (
                      <li key={r.id}>
                        <Link
                          href={`/overview/incidents/${encodeURIComponent(r.id)}`}
                          className={cn(
                            "block rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 transition",
                            "hover:border-[var(--accent)]/50 hover:bg-[var(--surface)]",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="line-clamp-2 text-sm font-medium leading-snug">
                              {r.title}
                            </p>
                            <ReportStatusBadge
                              status={r.status}
                              className="shrink-0"
                            />
                          </div>
                          <p className="mt-1.5 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
                            {hazardHintLabel(r.hazardHint)} · Brgy. {r.barangay}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                            {r.citizenName} ·{" "}
                            {new Date(r.createdAt).toLocaleString()}
                          </p>
                          <div className="mt-2 flex items-center gap-2 border-t border-[var(--border)]/70 pt-2">
                            {r.investigatorUid || r.investigatorName ? (
                              <>
                                <ProfileAvatar
                                  name={
                                    r.investigatorName ||
                                    officerByUid.get(r.investigatorUid ?? "")
                                      ?.displayName ||
                                    "Officer"
                                  }
                                  photoURL={
                                    officerByUid.get(r.investigatorUid ?? "")
                                      ?.photoURL ?? null
                                  }
                                  seed={
                                    r.investigatorUid ||
                                    r.investigatorName ||
                                    undefined
                                  }
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  <p className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                                    Assigned
                                  </p>
                                  <p className="truncate text-xs font-medium text-[var(--foreground)]">
                                    {r.investigatorName ||
                                      officerByUid.get(r.investigatorUid ?? "")
                                        ?.displayName ||
                                      "Officer"}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <>
                                <span
                                  className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-[10px] text-[var(--muted)]"
                                  aria-hidden
                                >
                                  ?
                                </span>
                                <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                                  Unassigned
                                </p>
                              </>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
