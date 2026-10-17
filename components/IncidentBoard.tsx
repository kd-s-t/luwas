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
import { CriticalInfo } from "@/components/CriticalInfo";
import { OfficerWorkloadInfo } from "@/components/OfficerWorkloadInfo";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { TrustScoreInfo } from "@/components/TrustScoreInfo";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer, type OfficerProfile } from "@/lib/auth/types";
import { triggerInvestigatorNotify } from "@/lib/alerts/notifyInvestigator";
import {
  setReportAssignees,
  updateReportStatus,
} from "@/lib/reports/api";
import {
  assigneeLabel,
  reportHasAssignee,
} from "@/lib/reports/assignees";
import { scopeLabel } from "@/lib/reports/barangayScope";
import { PRIORITY_RANK } from "@/lib/reports/priority";
import {
  hideScenarioDemoReportsInUi,
  isTinoScenarioDemoReport,
} from "@/lib/reports/scenarioDemo";
import {
  hazardHintLabel,
  reportPriorityLabel,
  type HazardReport,
  type ReportAssignee,
  type ReportPriority,
  type ReportStatus,
} from "@/lib/reports/types";
import { APAS_STAFF_SEED } from "@/lib/staff/apasStaff";
import { NANGKA_STAFF_SEED } from "@/lib/staff/nangkaStaff";
import { useScenario } from "@/lib/scenarios";
import { cn } from "@/lib/utils";

function priorityTone(priority: ReportPriority) {
  if (priority === "critical") {
    return "bg-[#c72929]/10 text-[#c72929] ring-[#c72929]/25";
  }
  if (priority === "high") {
    return "bg-[#fff7ed] text-[#c2410c] ring-[#fdba74]/70";
  }
  if (priority === "medium") {
    return "bg-[#eff6ff] text-[#2f5f9e] ring-[#93c5fd]/70";
  }
  return "bg-[var(--foreground)]/6 text-[var(--muted)] ring-[var(--border)]";
}

type BoardColumnId =
  | "queue"
  | "assigned"
  | "verified"
  | "dispatched"
  | "done"
  | "rejected";

type BoardColumn = {
  id: BoardColumnId;
  label: string;
  match: (r: HazardReport) => boolean;
  /** Status written when a card is dropped on this column. */
  dropStatus: ReportStatus;
};

const COLUMNS: BoardColumn[] = [
  {
    id: "queue",
    label: "Queue",
    dropStatus: "queued",
    match: (r) =>
      r.status === "queued" ||
      r.status === "validating" ||
      r.status === "needs_review" ||
      r.status === "failed" ||
      r.status === "draft",
  },
  {
    id: "verified",
    label: "Verified",
    dropStatus: "legit",
    match: (r) => r.status === "legit",
  },
  {
    id: "assigned",
    label: "Assigned",
    dropStatus: "assigned",
    match: (r) => r.status === "assigned",
  },
  {
    id: "dispatched",
    label: "Dispatched",
    dropStatus: "dispatched",
    match: (r) => r.status === "dispatched",
  },
  {
    id: "done",
    label: "Done",
    dropStatus: "done",
    match: (r) => r.status === "done",
  },
  {
    id: "rejected",
    label: "Rejected",
    dropStatus: "rejected",
    match: (r) => r.status === "rejected",
  },
];

const DRAG_MIME = "application/x-ugnai-report-id";

function hasAssignee(report: HazardReport): boolean {
  return reportHasAssignee(report);
}

/** Prefer dedicated stamp; fall back for older dispatched docs. */
function dispatchOutSince(report: HazardReport): string | null {
  if (report.status !== "dispatched") return null;
  const raw =
    report.dispatchedAt?.trim() ||
    report.dispatchLog?.at?.trim() ||
    report.updatedAt?.trim() ||
    "";
  return raw || null;
}

function formatOutDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function DispatchOutTimer({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const start = Date.parse(since);
  if (!Number.isFinite(start)) return null;
  const ms = Math.max(0, now - start);
  return (
    <p
      className="mt-1 font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase tabular-nums"
      title={`Dispatched ${new Date(since).toLocaleString()}`}
    >
      Out · {formatOutDuration(ms)}
    </p>
  );
}

function assigneesOf(report: HazardReport): ReportAssignee[] {
  return report.assignees?.length
    ? report.assignees
    : report.investigatorUid
      ? [
          {
            uid: report.investigatorUid,
            name: report.investigatorName || report.investigatorUid,
            assignedAt: report.investigatedAt || report.updatedAt,
          },
        ]
      : [];
}

export function IncidentBoard() {
  const { profile } = useAuth();
  const { officerBundle, tinoActive } = useScenario();
  const { scopedReports, activeOfficers, reportScope, seedReady } =
    useCommandWorkspace();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { isSimulationOn } = await import("@/lib/config/simulation");
        if (!isSimulationOn()) return;
        const { ensureQueueSampleReports } = await import(
          "@/lib/reports/ensureQueueSampleReports"
        );
        if (cancelled) return;
        await ensureQueueSampleReports();
      } catch (err) {
        console.warn("Queue sample seed failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seedReady]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropColId, setDropColId] = useState<BoardColumnId | null>(null);
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

  const ranked = useMemo(() => {
    const hideDemo = hideScenarioDemoReportsInUi();
    const list = hideDemo
      ? scopedReports.filter((r) => !isTinoScenarioDemoReport(r))
      : scopedReports;
    return [...list].sort((a, b) => {
      const pa = a.aiPriority ? PRIORITY_RANK[a.aiPriority] : 9;
      const pb = b.aiPriority ? PRIORITY_RANK[b.aiPriority] : 9;
      if (pa !== pb) return pa - pb;
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }, [scopedReports]);

  const queueCount = ranked.filter((r) =>
    COLUMNS[0]!.match(r),
  ).length;
  const orgHint = isOfficer(profile) ? profile.orgName : null;
  const assignTicket = assignMenuId
    ? ranked.find((r) => r.id === assignMenuId) ?? null
    : null;

  async function saveAssignees(
    report: HazardReport,
    next: { uid: string; name: string }[],
    opts?: { close?: boolean; notifyUid?: string },
  ) {
    setBusyId(report.id);
    setError(null);
    try {
      await setReportAssignees({
        reportId: report.id,
        assignees: next,
      });
      if (opts?.notifyUid) {
        const row = next.find((a) => a.uid === opts.notifyUid);
        if (row) {
          const officer = officerByUid.get(row.uid);
          const staff =
            APAS_STAFF_SEED.find((s) => s.id === officer?.staffId) ||
            NANGKA_STAFF_SEED.find((s) => s.id === officer?.staffId) ||
            [...APAS_STAFF_SEED, ...NANGKA_STAFF_SEED].find(
              (s) =>
                s.displayName.toLowerCase() === row.name.trim().toLowerCase(),
            );
          void triggerInvestigatorNotify({
            report,
            investigatorUid: row.uid,
            investigatorName: row.name,
            phone: staff?.phone ?? null,
            staffId: officer?.staffId ?? staff?.id ?? null,
            email: officer?.email ?? staff?.email ?? null,
          });
        }
      }
      if (opts?.close) closeAssignMenu();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusyId(null);
    }
  }

  async function toggleAssignee(
    report: HazardReport,
    uid: string,
    name: string,
  ) {
    const current = assigneesOf(report);
    const exists = current.some((a) => a.uid === uid);
    const next = exists
      ? current.filter((a) => a.uid !== uid).map((a) => ({
          uid: a.uid,
          name: a.name,
        }))
      : [...current.map((a) => ({ uid: a.uid, name: a.name })), { uid, name }];
    await saveAssignees(report, next, {
      notifyUid: exists ? undefined : uid,
    });
  }

  async function moveToColumn(report: HazardReport, col: BoardColumn) {
    if (col.match(report)) return;
    if (col.id === "dispatched" && !hasAssignee(report)) {
      setError("Assign an officer before moving to Dispatched.");
      return;
    }
    setBusyId(report.id);
    setError(null);
    try {
      if (col.id === "assigned") {
        if (!hasAssignee(report) && isOfficer(profile)) {
          await saveAssignees(
            report,
            [
              {
                uid: profile.uid,
                name: profile.displayName || profile.email,
              },
            ],
            { close: true, notifyUid: profile.uid },
          );
          return;
        }
        await updateReportStatus(report.id, "assigned");
        return;
      }
      await updateReportStatus(report.id, col.dropStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Move failed");
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
    <div className="bg-[var(--surface)]">
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-raised)]/95 px-4 py-3 backdrop-blur-sm sm:px-6">
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
                {tinoActive
                  ? `${officerBundle.shortLabel} · ${scopeLabel(reportScope)}`
                  : scopeLabel(reportScope)}
              </h1>
              <TrustScoreInfo />
              <OfficerWorkloadInfo />
              <CriticalInfo />
            </div>
            <p className="text-xs text-[var(--muted)]">
              {queueCount} in queue · drag cards across columns
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
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
            No field reports in scope yet
          </p>
          <p className="max-w-md text-sm text-[var(--muted)]">
            When citizens post reports for {scopeLabel(reportScope)}, they
            appear on this board.
          </p>
        </div>
      ) : (
        <div className="flex w-full items-stretch gap-2 overflow-x-auto px-3 py-3 sm:gap-3 sm:px-4 sm:py-4">
          {COLUMNS.map((col) => {
            const cards = ranked.filter(col.match);
            const dragging = dragId
              ? ranked.find((r) => r.id === dragId)
              : null;
            const rejectDrop =
              dragging != null &&
              col.id === "dispatched" &&
              !hasAssignee(dragging);
            return (
              <section
                key={col.id}
                onDragOver={(e) => {
                  if (dropColId !== col.id) setDropColId(col.id);
                  const block =
                    col.id === "dispatched" &&
                    (dragging == null || !hasAssignee(dragging));
                  if (block) {
                    e.dataTransfer.dropEffect = "none";
                    return;
                  }
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDropColId((cur) => (cur === col.id ? null : cur));
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropColId(null);
                  const id =
                    e.dataTransfer.getData(DRAG_MIME) ||
                    e.dataTransfer.getData("text/plain");
                  const report = ranked.find((r) => r.id === id);
                  setDragId(null);
                  if (!report) return;
                  if (col.id === "dispatched" && !hasAssignee(report)) {
                    setError(
                      "Assign an officer before moving to Dispatched.",
                    );
                    return;
                  }
                  void moveToColumn(report, col);
                }}
                className={cn(
                  "flex w-[17.5rem] shrink-0 flex-col self-stretch rounded-2xl border bg-[#eef1f5] transition sm:w-[18.5rem]",
                  rejectDrop && dropColId === col.id
                    ? "border-[#c72929]/50 bg-[#c72929]/5"
                    : dropColId === col.id
                      ? "border-[var(--accent)] bg-[var(--accent)]/5"
                      : "border-transparent",
                )}
              >
                <header className="flex shrink-0 items-baseline justify-between gap-2 px-3.5 pt-3.5 pb-2">
                  <h2 className="text-[11px] font-bold tracking-[0.14em] text-[var(--foreground)] uppercase">
                    {col.label}
                  </h2>
                  <span className="text-[11px] tabular-nums text-[var(--muted)]">
                    {cards.length}
                  </span>
                </header>
                <ul className="flex flex-1 flex-col space-y-2.5 px-2.5 pb-2.5">
                  {cards.length === 0 ? (
                    <li className="flex flex-1 items-start justify-center px-2 pt-6 text-center text-xs text-[var(--muted)]">
                      Drop here
                    </li>
                  ) : (
                    cards.map((r) => (
                      <li key={r.id}>
                        <div
                          draggable={busyId !== r.id}
                          onDragStart={(e) => {
                            e.dataTransfer.setData(DRAG_MIME, r.id);
                            e.dataTransfer.setData("text/plain", r.id);
                            e.dataTransfer.effectAllowed = "move";
                            setDragId(r.id);
                            closeAssignMenu();
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setDropColId(null);
                          }}
                          className={cn(
                            "group relative cursor-grab rounded-xl border border-[var(--border)] bg-white px-3.5 py-3 transition active:cursor-grabbing",
                            "hover:border-[#93c5fd]/80",
                            (busyId === r.id || dragId === r.id) && "opacity-60",
                          )}
                        >
                          <Link
                            href={`/admin/incidents/${encodeURIComponent(r.id)}`}
                            draggable={false}
                            aria-label={`Open ${r.title}`}
                            className="absolute inset-0 z-[1] rounded-xl"
                          />
                          <div className="relative z-0">
                          <p className="break-all font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase tabular-nums">
                            {r.id}
                          </p>
                          <p className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--foreground)] group-hover:text-[#2563eb]">
                            {r.title}
                          </p>
                          <p className="mt-1.5 truncate text-[12px] text-[var(--muted)]">
                            {r.citizenName}:{" "}
                            {new Date(r.createdAt).toLocaleString()}
                          </p>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                            {r.aiPriority ? (
                              <span
                                className={cn(
                                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1",
                                  priorityTone(r.aiPriority),
                                )}
                              >
                                {reportPriorityLabel(r.aiPriority)}
                              </span>
                            ) : null}
                          </div>
                          {(() => {
                            const outSince = dispatchOutSince(r);
                            return outSince ? (
                              <DispatchOutTimer since={outSince} />
                            ) : null;
                          })()}
                          </div>

                          <div className="relative z-[2] mt-3 border-t border-[var(--border)] pt-2.5">
                            {(() => {
                              const assigned = assigneesOf(r);
                              return (
                            <button
                              type="button"
                              disabled={busyId === r.id}
                              aria-haspopup="listbox"
                              aria-expanded={assignMenuId === r.id}
                              aria-label={
                                assigned.length > 0
                                  ? `Assigned to ${assigneeLabel(assigned)}. Change assignees`
                                  : "Assign investigators"
                              }
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                openAssignMenu(r.id, e.currentTarget);
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className={cn(
                                "relative z-[2] flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition disabled:opacity-50",
                                assigned.length > 0
                                  ? "bg-[#f8fafc] hover:bg-[#eff6ff]"
                                  : "bg-[#eff6ff] text-[#2563eb] hover:bg-[#dbeafe]",
                              )}
                            >
                              {assigned.length > 0 ? (
                                <>
                                  <div className="flex shrink-0 -space-x-1.5">
                                    {assigned.slice(0, 3).map((a) => (
                                      <ProfileAvatar
                                        key={a.uid}
                                        name={
                                          a.name ||
                                          officerByUid.get(a.uid)?.displayName ||
                                          "Officer"
                                        }
                                        photoURL={
                                          officerByUid.get(a.uid)?.photoURL ??
                                          null
                                        }
                                        seed={
                                          a.name ||
                                          officerByUid.get(a.uid)?.displayName ||
                                          a.uid
                                        }
                                        size="sm"
                                      />
                                    ))}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-medium tracking-wide text-[var(--muted)] uppercase">
                                      {assigned.length > 1
                                        ? `${assigned.length} assigned`
                                        : "Assigned"}
                                    </p>
                                    <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                                      {assigneeLabel(assigned)}
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <p className="w-full text-center text-[12px] font-semibold text-[#2563eb]">
                                  + Assign
                                </p>
                              )}
                            </button>
                              );
                            })()}
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
              <div className="shrink-0 border-b border-[var(--border)] px-2.5 py-1.5">
                <p className="text-[10px] text-[var(--muted)]">
                  Tap officers to add or remove. Multiple allowed.
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {showUnassigned ? (
                  <button
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-panel)]"
                    onClick={() =>
                      void saveAssignees(assignTicket, [], { close: true })
                    }
                  >
                    <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-[10px] text-[var(--muted)]">
                      —
                    </span>
                    Clear all
                  </button>
                ) : null}
                {showMe && isOfficer(profile) ? (
                  <button
                    type="button"
                    role="option"
                    aria-selected={assigneesOf(assignTicket).some(
                      (a) => a.uid === profile.uid,
                    )}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-panel)]",
                      assigneesOf(assignTicket).some(
                        (a) => a.uid === profile.uid,
                      ) && "bg-[var(--accent)]/10",
                    )}
                    onClick={() =>
                      void toggleAssignee(
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
                    <span className="min-w-0 flex-1 truncate">
                      Me · {profile.displayName || profile.email}
                    </span>
                    {assigneesOf(assignTicket).some(
                      (a) => a.uid === profile.uid,
                    ) ? (
                      <span className="text-[10px] font-semibold text-[#16794c]">
                        ✓
                      </span>
                    ) : null}
                  </button>
                ) : null}
                {filteredOfficers.map((o) => {
                  const selected = assigneesOf(assignTicket).some(
                    (a) => a.uid === o.uid,
                  );
                  return (
                  <button
                    key={o.uid}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-panel)]",
                      selected && "bg-[var(--accent)]/10",
                    )}
                    onClick={() =>
                      void toggleAssignee(
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
                    <span className="min-w-0 flex-1 truncate">
                      {o.displayName || o.email}
                    </span>
                    {selected ? (
                      <span className="text-[10px] font-semibold text-[#16794c]">
                        ✓
                      </span>
                    ) : null}
                  </button>
                  );
                })}
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
