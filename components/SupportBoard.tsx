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
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isAccountActive,
  isDeveloper,
  type DeveloperProfile,
} from "@/lib/auth/types";
import {
  assignSupportTicket,
  isPlaceholderAssignee,
  subscribeSupportTickets,
  updateSupportTicketStatus,
  type SupportTicket,
  type SupportTicketStatus,
} from "@/lib/support/api";
import { collection, onSnapshot } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { cn } from "@/lib/utils";

type BoardColumn = {
  id: SupportTicketStatus;
  label: string;
  match: (t: SupportTicket) => boolean;
};

const COLUMNS: BoardColumn[] = [
  {
    id: "open",
    label: "Open",
    match: (t) => t.status === "open",
  },
  {
    id: "in_progress",
    label: "In progress",
    match: (t) => t.status === "in_progress",
  },
  {
    id: "resolved",
    label: "Resolved",
    match: (t) => t.status === "resolved",
  },
  {
    id: "closed",
    label: "Closed",
    match: (t) => t.status === "closed",
  },
];

const DRAG_TYPE = "application/x-ugnai-support-ticket";

function statusTone(status: SupportTicketStatus) {
  if (status === "open") {
    return "bg-[#c72929]/10 text-[#c72929] ring-[#c72929]/25";
  }
  if (status === "in_progress") {
    return "bg-[#fff7ed] text-[#c2410c] ring-[#fdba74]/70";
  }
  if (status === "resolved") {
    return "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60";
  }
  return "bg-[var(--foreground)]/6 text-[var(--muted)] ring-[var(--border)]";
}

function statusLabel(status: SupportTicketStatus): string {
  if (status === "in_progress") return "In progress";
  return status;
}

export function SupportBoard() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [developers, setDevelopers] = useState<DeveloperProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<SupportTicketStatus | null>(
    null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [assignMenuId, setAssignMenuId] = useState<string | null>(null);
  const [assignQuery, setAssignQuery] = useState("");
  const [assignPos, setAssignPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const draggedRef = useRef(false);
  const assignMenuRef = useRef<HTMLDivElement | null>(null);
  const assignSearchRef = useRef<HTMLInputElement | null>(null);
  const assignAnchorRef = useRef<HTMLElement | null>(null);

  function closeAssignMenu() {
    setAssignMenuId(null);
    setAssignQuery("");
    setAssignPos(null);
    assignAnchorRef.current = null;
  }

  function openAssignMenu(ticketId: string, anchor: HTMLElement) {
    assignAnchorRef.current = anchor;
    setAssignQuery("");
    setAssignMenuId((cur) => (cur === ticketId ? null : ticketId));
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

  useEffect(() => {
    if (!isDeveloper(profile) || !isAccountActive(profile)) {
      setRows([]);
      return;
    }
    return subscribeSupportTickets(setRows);
  }, [profile]);

  useEffect(() => {
    if (!isDeveloper(profile) || !isAccountActive(profile)) {
      setDevelopers([]);
      return;
    }
    return onSnapshot(collection(getClientDb(), "users"), (snap) => {
      const next: DeveloperProfile[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        if (data.role !== "developer") continue;
        const status = data.accountStatus as string | undefined;
        if (status === "fired" || status === "rejected" || status === "pending") {
          continue;
        }
        next.push({
          uid: String(data.uid ?? d.id),
          email: String(data.email ?? ""),
          displayName: String(data.displayName ?? ""),
          orgName: String(data.orgName ?? ""),
          role: "developer",
          createdAt: String(data.createdAt ?? ""),
          accountStatus: "active",
          photoURL: data.photoURL != null ? String(data.photoURL) : null,
        });
      }
      next.sort((a, b) =>
        (a.displayName || a.email).localeCompare(b.displayName || b.email),
      );
      setDevelopers(next);
    });
  }, [profile]);

  const openCount = useMemo(
    () =>
      rows.filter((t) => t.status === "open" || t.status === "in_progress")
        .length,
    [rows],
  );

  const developerByUid = useMemo(() => {
    const map = new Map<string, DeveloperProfile>();
    for (const d of developers) map.set(d.uid, d);
    if (isDeveloper(profile)) {
      map.set(profile.uid, profile);
    }
    return map;
  }, [developers, profile]);

  const assignTicketRow = useMemo(
    () => (assignMenuId ? rows.find((t) => t.id === assignMenuId) : null),
    [assignMenuId, rows],
  );

  async function moveTicket(ticketId: string, status: SupportTicketStatus) {
    if (!isDeveloper(profile)) return;
    const ticket = rows.find((t) => t.id === ticketId);
    if (!ticket || ticket.status === status) return;

    setBusyId(ticketId);
    setError(null);
    setRows((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status } : t)),
    );
    try {
      await updateSupportTicketStatus({
        ticketId,
        status,
        officerUid: profile.uid,
        officerName: profile.displayName || profile.email,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
      setRows((prev) =>
        prev.map((t) =>
          t.id === ticketId ? { ...t, status: ticket.status } : t,
        ),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function assignTicket(
    ticket: SupportTicket,
    assigneeUid: string | null,
    assigneeName: string | null,
  ) {
    if (!isDeveloper(profile)) return;
    setBusyId(ticket.id);
    setError(null);
    const promote = Boolean(assigneeUid) && ticket.status === "open";
    setRows((prev) =>
      prev.map((t) =>
        t.id === ticket.id
          ? {
              ...t,
              assignedToUid: assigneeUid,
              assignedToName: assigneeName,
              status: promote ? "in_progress" : t.status,
            }
          : t,
      ),
    );
    try {
      await assignSupportTicket({
        ticketId: ticket.id,
        assigneeUid,
        assigneeName,
        promoteToInProgress: promote,
      });
      closeAssignMenu();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
      setRows((prev) =>
        prev.map((t) => (t.id === ticket.id ? ticket : t)),
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!isDeveloper(profile) || !isAccountActive(profile)) {
    return (
      <p className="p-6 text-sm text-[var(--muted)]">
        Only developers can triage support tickets.
      </p>
    );
  }

  const q = assignQuery.trim().toLowerCase();
  const match = (label: string) => !q || label.toLowerCase().includes(q);
  const filteredDevelopers = developers.filter(
    (d) =>
      d.uid !== profile?.uid &&
      match(`${d.displayName || ""} ${d.email || ""}`),
  );
  const showMe =
    isDeveloper(profile) &&
    match(`me ${profile.displayName || ""} ${profile.email || ""}`);
  const showUnassigned = !q || "unassigned".includes(q);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--surface)]">
      <div className="sticky top-0 z-10 shrink-0 border-b border-[var(--border)] bg-[var(--surface-raised)]/95 px-4 py-3 backdrop-blur-sm sm:px-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
            Support
          </p>
          <Link
            href="/dev"
            className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--accent)]"
          >
            ← Developers
          </Link>
        </div>
        <div className="mt-0.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide sm:text-2xl">
                Support tickets
              </h1>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {openCount} open · drag cards across columns
            </p>
          </div>
          <Link
            href="/dev/support/new"
            className="rounded-lg bg-[var(--foreground)] px-3 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
          >
            New ticket
          </Link>
        </div>
        {error ? (
          <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
            No support tickets yet
          </p>
          <p className="max-w-md text-sm text-[var(--muted)]">
            Tickets from officers, citizens, guests, and developers land here.
          </p>
          <Link
            href="/dev/support/new"
            className="mt-2 rounded-lg bg-[var(--foreground)] px-3 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
          >
            New ticket
          </Link>
        </div>
      ) : (
        <div className="flex min-h-0 w-full flex-1 items-stretch gap-2 overflow-x-auto px-3 py-3 sm:gap-3 sm:px-4 sm:py-4">
          {COLUMNS.map((col) => {
            const cards = rows.filter(col.match);
            const isOver = dropTarget === col.id;
            return (
              <section
                key={col.id}
                className={cn(
                  "flex w-[17.5rem] shrink-0 flex-col self-stretch rounded-2xl border bg-[#eef1f5] transition sm:w-[18.5rem]",
                  isOver
                    ? "border-[var(--accent)] bg-[var(--accent)]/5"
                    : "border-transparent",
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dropTarget !== col.id) setDropTarget(col.id);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) {
                    return;
                  }
                  if (dropTarget === col.id) setDropTarget(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropTarget(null);
                  const id =
                    e.dataTransfer.getData(DRAG_TYPE) ||
                    e.dataTransfer.getData("text/plain");
                  if (!id) return;
                  void moveTicket(id, col.id);
                  setDraggingId(null);
                }}
              >
                <header className="flex shrink-0 items-baseline justify-between gap-2 px-3.5 pt-3.5 pb-2">
                  <h2 className="text-[11px] font-bold tracking-[0.14em] text-[var(--foreground)] uppercase">
                    {col.label}
                  </h2>
                  <span className="text-[11px] tabular-nums text-[var(--muted)]">
                    {cards.length}
                  </span>
                </header>
                <ul className="flex min-h-0 flex-1 flex-col space-y-2.5 overflow-y-auto px-2.5 pb-2.5">
                  {cards.length === 0 ? (
                    <li className="flex flex-1 items-start justify-center px-2 pt-6 text-center text-xs text-[var(--muted)]">
                      Drop here
                    </li>
                  ) : (
                    cards.map((t) => {
                      const assigned =
                        !isPlaceholderAssignee(
                          t.assignedToUid,
                          t.assignedToName,
                        ) && Boolean(t.assignedToUid || t.assignedToName);
                      const assigneeName =
                        t.assignedToName ||
                        developerByUid.get(t.assignedToUid ?? "")
                          ?.displayName ||
                        "Developer";
                      return (
                        <li key={t.id}>
                          <div
                            draggable={busyId !== t.id}
                            onDragStart={(e) => {
                              const target = e.target as HTMLElement;
                              if (
                                target.closest("a") ||
                                target.closest("button")
                              ) {
                                e.preventDefault();
                                return;
                              }
                              draggedRef.current = false;
                              setDraggingId(t.id);
                              closeAssignMenu();
                              e.dataTransfer.setData(DRAG_TYPE, t.id);
                              e.dataTransfer.setData("text/plain", t.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDrag={() => {
                              draggedRef.current = true;
                            }}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDropTarget(null);
                              window.setTimeout(() => {
                                draggedRef.current = false;
                              }, 0);
                            }}
                            className={cn(
                              "group relative cursor-grab rounded-xl border border-[var(--border)] bg-white px-3.5 py-3 transition active:cursor-grabbing",
                              "hover:border-[#93c5fd]/80",
                              (busyId === t.id || draggingId === t.id) &&
                                "opacity-60",
                              busyId === t.id && "cursor-wait",
                            )}
                          >
                            <Link
                              href={`/dev/support/${encodeURIComponent(t.id)}`}
                              draggable={false}
                              aria-label={`Open ${t.summary}`}
                              className="absolute inset-0 z-[1] rounded-xl"
                              onClick={(e) => {
                                if (draggedRef.current) e.preventDefault();
                              }}
                            />
                            <div className="relative z-0">
                              <p className="break-all font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase tabular-nums">
                                {t.id}
                              </p>
                              <p className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--foreground)] group-hover:text-[#2563eb]">
                                {t.summary}
                              </p>
                              <p className="mt-1.5 truncate text-[12px] text-[var(--muted)]">
                                {t.email || "No email"}
                                {t.createdAt
                                  ? `: ${new Date(t.createdAt).toLocaleString()}`
                                  : ""}
                              </p>
                              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase ring-1",
                                    statusTone(t.status),
                                  )}
                                >
                                  {statusLabel(t.status)}
                                </span>
                              </div>
                            </div>

                            <div className="relative z-[2] mt-3 border-t border-[var(--border)] pt-2.5">
                              <button
                                type="button"
                                disabled={busyId === t.id}
                                draggable={false}
                                aria-haspopup="listbox"
                                aria-expanded={assignMenuId === t.id}
                                aria-label={
                                  assigned
                                    ? `Assigned to ${assigneeName}. Change assignee`
                                    : "Assign developer"
                                }
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openAssignMenu(t.id, e.currentTarget);
                                }}
                                className={cn(
                                  "relative z-[2] flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition disabled:opacity-50",
                                  assigned
                                    ? "bg-[#f8fafc] hover:bg-[#eff6ff]"
                                    : "bg-[#eff6ff] text-[#2563eb] hover:bg-[#dbeafe]",
                                )}
                              >
                                {assigned ? (
                                  <>
                                    <ProfileAvatar
                                      name={assigneeName}
                                      photoURL={
                                        developerByUid.get(
                                          t.assignedToUid ?? "",
                                        )?.photoURL ?? null
                                      }
                                      seed={
                                        assigneeName ||
                                        t.assignedToUid ||
                                        undefined
                                      }
                                      size="sm"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[10px] font-medium tracking-wide text-[var(--muted)] uppercase">
                                        Assigned
                                      </p>
                                      <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                                        {assigneeName}
                                      </p>
                                    </div>
                                  </>
                                ) : (
                                  <p className="w-full text-center text-[12px] font-semibold text-[#2563eb]">
                                    + Assign
                                  </p>
                                )}
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {assignMenuId &&
      assignPos &&
      assignTicketRow &&
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
                  placeholder="Search developers…"
                  aria-label="Search developers"
                  className="w-full bg-[var(--input)] px-2 py-1.5 text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--accent)]"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto py-1">
                {showUnassigned ? (
                  <button
                    type="button"
                    role="option"
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-panel)]"
                    onClick={() => {
                      void assignTicket(assignTicketRow, null, null);
                    }}
                  >
                    <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-[10px] text-[var(--muted)]">
                      —
                    </span>
                    Unassigned
                  </button>
                ) : null}
                {showMe && isDeveloper(profile) ? (
                  <button
                    type="button"
                    role="option"
                    aria-selected={
                      assignTicketRow.assignedToUid === profile.uid
                    }
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-panel)]",
                      assignTicketRow.assignedToUid === profile.uid &&
                        "bg-[var(--accent)]/10",
                    )}
                    onClick={() => {
                      void assignTicket(
                        assignTicketRow,
                        profile.uid,
                        profile.displayName || profile.email,
                      );
                    }}
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
                {filteredDevelopers.map((d) => (
                  <button
                    key={d.uid}
                    type="button"
                    role="option"
                    aria-selected={assignTicketRow.assignedToUid === d.uid}
                    className={cn(
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-panel)]",
                      assignTicketRow.assignedToUid === d.uid &&
                        "bg-[var(--accent)]/10",
                    )}
                    onClick={() => {
                      void assignTicket(
                        assignTicketRow,
                        d.uid,
                        d.displayName || d.email,
                      );
                    }}
                  >
                    <ProfileAvatar
                      name={d.displayName || d.email}
                      photoURL={d.photoURL}
                      seed={d.displayName || d.email}
                      size="sm"
                    />
                    <span className="min-w-0 truncate">
                      {d.displayName || d.email}
                    </span>
                  </button>
                ))}
                {!showUnassigned &&
                !showMe &&
                filteredDevelopers.length === 0 ? (
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
