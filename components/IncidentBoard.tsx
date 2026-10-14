"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { OfficerWorkloadInfo } from "@/components/OfficerWorkloadInfo";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isOfficer,
  type OfficerProfile,
} from "@/lib/auth/types";
import { assignReportInvestigator } from "@/lib/reports/api";
import {
  scopeAnchor,
  scopeLabel,
  sortReportsByDistance,
} from "@/lib/reports/barangayScope";
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
  const { officerBundle, simulationOn } = useScenario();
  const { scopedReports, activeOfficers, reportScope } = useCommandWorkspace();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignMenuId, setAssignMenuId] = useState<string | null>(null);
  const [assignQuery, setAssignQuery] = useState("");
  const [assignPos, setAssignPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const assignMenuRef = useRef<HTMLDivElement | null>(null);
  const assignSearchRef = useRef<HTMLInputElement | null>(null);
  const assignAnchorRef = useRef<HTMLElement | null>(null);

  function closeAssignMenu() {
    setAssignMenuId(null);
    setAssignQuery("");
    setAssignPos(null);
    assignAnchorRef.current = null;
  }

  function openAssignMenu(reportId: string, anchor: HTMLElement) {
    if (assignMenuId === reportId) {
      closeAssignMenu();
      return;
    }
    assignAnchorRef.current = anchor;
    setAssignQuery("");
    setAssignMenuId(reportId);
  }

  useLayoutEffect(() => {
    if (!assignMenuId || !assignAnchorRef.current) {
      setAssignPos(null);
      return;
    }
    function place() {
      const el = assignAnchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const width = Math.max(r.width, 220);
      const left = Math.min(
        Math.max(8, r.left),
        window.innerWidth - width - 8,
      );
      const below = r.bottom + 6;
      const menuH = 280;
      const top =
        below + menuH > window.innerHeight - 8
          ? Math.max(8, r.top - menuH - 6)
          : below;
      setAssignPos({ top, left, width });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [assignMenuId]);

  useEffect(() => {
    if (!assignMenuId) return;
    const t = window.setTimeout(() => assignSearchRef.current?.focus(), 0);
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (assignMenuRef.current?.contains(target)) return;
      if (assignAnchorRef.current?.contains(target)) return;
      closeAssignMenu();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeAssignMenu();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [assignMenuId]);

  const officerByUid = useMemo(() => {
    const map = new Map<string, OfficerProfile>();
    for (const o of activeOfficers) map.set(o.uid, o);
    if (isOfficer(profile)) map.set(profile.uid, profile);
    return map;
  }, [activeOfficers, profile]);

  const ranked = useMemo(
    () =>
      sortReportsByDistance(
        scopedReports,
        scopeAnchor(reportScope),
      ).map((x) => x.report),
    [scopedReports, reportScope],
  );

  const queueCount = ranked.filter((r) => REVIEW_STATUSES.has(r.status)).length;
  const orgHint = isOfficer(profile) ? profile.orgName : null;
  const assignTicket = assignMenuId
    ? ranked.find((r) => r.id === assignMenuId) ?? null
    : null;

  async function assignInvestigator(
    report: HazardReport,
    investigatorUid: string | null,
    investigatorName: string | null,
  ) {
    setBusyId(report.id);
    setError(null);
    try {
      await assignReportInvestigator({
        reportId: report.id,
        investigatorUid,
        investigatorName,
      });
      closeAssignMenu();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusyId(null);
    }
  }

  const q = assignQuery.trim().toLowerCase();
  const match = (label: string) => !q || label.toLowerCase().includes(q);
  const filteredOfficers = activeOfficers.filter(
    (o) =>
      o.uid !== profile?.uid &&
      match(`${o.displayName || ""} ${o.email || ""}`),
  );
  const showMe =
    isOfficer(profile) &&
    match(`me ${profile.displayName || ""} ${profile.email || ""}`);
  const showUnassigned = match("unassigned");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--surface)]">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-raised)]/90 px-4 py-3 sm:px-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
            Incidents
          </p>
          <Link
            href="/admin/overview"
            className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--accent)]"
          >
            ← Overview
          </Link>
        </div>
        <div className="mt-0.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide sm:text-2xl">
                {simulationOn
                  ? `${officerBundle.shortLabel} · ${scopeLabel(reportScope)}`
                  : scopeLabel(reportScope)}
              </h1>
              <OfficerWorkloadInfo />
            </div>
            <p className="text-xs text-[var(--muted)]">
              {queueCount} awaiting review · assign on the card · open for
              evidence
              {orgHint ? ` · ${orgHint}` : ""}
            </p>
          </div>
          <p className="max-w-sm text-right text-[11px] text-[var(--muted)]">
            AI proposals are not authorized plans. Verify before allocating aid.
          </p>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {ranked.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
            No field reports in scope yet
          </p>
          <p className="max-w-md text-sm text-[var(--muted)]">
            When citizens or relay channels post reports for {scopeLabel(reportScope)},
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
                <ul
                  className={cn(
                    "min-h-0 flex-1 space-y-2 p-2",
                    assignMenuId ? "overflow-visible" : "overflow-y-auto",
                  )}
                >
                  {cards.length === 0 ? (
                    <li className="px-2 py-6 text-center text-xs text-[var(--muted)]">
                      No cards
                    </li>
                  ) : (
                    cards.map((r) => (
                      <li key={r.id}>
                        <div
                          className={cn(
                            "rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 transition",
                            "hover:border-[var(--accent)]/50 hover:bg-[var(--surface)]",
                            busyId === r.id && "opacity-60",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/admin/incidents/${encodeURIComponent(r.id)}`}
                              className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug hover:text-[var(--accent)] hover:underline"
                            >
                              {r.title}
                            </Link>
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
                          <div className="mt-2 border-t border-[var(--border)]/70 pt-2">
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              aria-haspopup="listbox"
                              aria-expanded={assignMenuId === r.id}
                              aria-label={
                                r.investigatorName
                                  ? `Assigned to ${r.investigatorName}. Change assignee`
                                  : "Assign investigator"
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                openAssignMenu(r.id, e.currentTarget);
                              }}
                              className="flex w-full items-center gap-2 rounded-md text-left transition hover:bg-[var(--surface-panel)]/60 disabled:opacity-50"
                            >
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
                                      r.investigatorName ||
                                      officerByUid.get(r.investigatorUid ?? "")
                                        ?.displayName ||
                                      r.investigatorUid ||
                                      undefined
                                    }
                                    size="sm"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                                      Assigned
                                    </p>
                                    <p className="truncate text-xs font-medium text-[var(--foreground)]">
                                      {r.investigatorName ||
                                        officerByUid.get(
                                          r.investigatorUid ?? "",
                                        )?.displayName ||
                                        "Officer"}
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-[10px] text-[var(--muted)]">
                                    +
                                  </span>
                                  <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                                    Assign
                                  </p>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {assignMenuId &&
      assignPos &&
      assignTicket &&
      typeof document !== "undefined"
        ? createPortal(
            <div
              ref={assignMenuRef}
              role="listbox"
              style={{
                position: "fixed",
                top: assignPos.top,
                left: assignPos.left,
                width: assignPos.width,
              }}
              className="z-[80] flex max-h-72 flex-col border border-[var(--border)] bg-[var(--surface-raised)] shadow-md"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="shrink-0 border-b border-[var(--border)] p-1.5">
                <input
                  ref={assignSearchRef}
                  type="search"
                  value={assignQuery}
                  onChange={(e) => setAssignQuery(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Search officers…"
                  aria-label="Search officers"
                  className="w-full bg-[var(--input)] px-2 py-1.5 text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--accent)]"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {showUnassigned ? (
                  <button
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-panel)]"
                    onClick={() =>
                      void assignInvestigator(assignTicket, null, null)
                    }
                  >
                    <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-[10px] text-[var(--muted)]">
                      —
                    </span>
                    Unassigned
                  </button>
                ) : null}
                {showMe && isOfficer(profile) ? (
                  <button
                    type="button"
                    role="option"
                    aria-selected={
                      assignTicket.investigatorUid === profile.uid
                    }
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-panel)]",
                      assignTicket.investigatorUid === profile.uid &&
                        "bg-[var(--accent)]/10",
                    )}
                    onClick={() =>
                      void assignInvestigator(
                        assignTicket,
                        profile.uid,
                        profile.displayName || profile.email,
                      )
                    }
                  >
                    <ProfileAvatar
                      name={profile.displayName || profile.email}
                      photoURL={profile.photoURL}
                      seed={profile.displayName || profile.email}
                      size="sm"
                    />
                    <span className="min-w-0 truncate">
                      Me · {profile.displayName || profile.email}
                    </span>
                  </button>
                ) : null}
                {filteredOfficers.map((o) => (
                  <button
                    key={o.uid}
                    type="button"
                    role="option"
                    aria-selected={assignTicket.investigatorUid === o.uid}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-panel)]",
                      assignTicket.investigatorUid === o.uid &&
                        "bg-[var(--accent)]/10",
                    )}
                    onClick={() =>
                      void assignInvestigator(
                        assignTicket,
                        o.uid,
                        o.displayName || o.email,
                      )
                    }
                  >
                    <ProfileAvatar
                      name={o.displayName || o.email}
                      photoURL={o.photoURL}
                      seed={o.displayName || o.email}
                      size="sm"
                    />
                    <span className="min-w-0 truncate">
                      {o.displayName || o.email}
                    </span>
                  </button>
                ))}
                {!showUnassigned && !showMe && filteredOfficers.length === 0 ? (
                  <p className="px-2.5 py-3 text-center text-xs text-[var(--muted)]">
                    No matches
                  </p>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
