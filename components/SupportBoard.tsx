"use client";

import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Badge } from "@/components/ui/badge";
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

function statusVariant(
  status: SupportTicketStatus,
): "default" | "outline" | "warn" | "danger" | "success" {
  if (status === "open") return "danger";
  if (status === "in_progress") return "warn";
  if (status === "resolved") return "success";
  return "outline";
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
    const promote =
      Boolean(assigneeUid) && ticket.status === "open";
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

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--surface)]">
      <div className="shrink-0 border-b border-[var(--border)] bg-[var(--surface-raised)]/90 px-4 py-3 sm:px-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
            Product support
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
              {openCount} open · drag to change status · assign on the card
            </p>
          </div>
          <Link
            href="/dev/support/new"
            className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase transition hover:underline"
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
            className="mt-2 font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase hover:underline"
          >
            New ticket
          </Link>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-x-auto px-3 py-3 sm:grid-cols-2 sm:px-4 sm:py-4 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const cards = rows.filter(col.match);
            const isOver = dropTarget === col.id;
            return (
              <section
                key={col.id}
                className={cn(
                  "flex min-h-0 min-w-0 flex-col rounded-lg border bg-[var(--surface-panel)]/40 transition",
                  isOver
                    ? "border-[var(--accent)] bg-[var(--accent)]/5"
                    : "border-[var(--border)]",
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
                    <li className="pointer-events-none px-2 py-6 text-center text-xs text-[var(--muted)]">
                      {isOver ? "Drop here" : "No cards"}
                    </li>
                  ) : (
                    cards.map((t) => (
                      <li key={t.id}>
                        <div
                          draggable={busyId !== t.id}
                          onDragStart={(e) => {
                            const target = e.target as HTMLElement;
                            if (
                              target.closest("select") ||
                              target.closest("a") ||
                              target.closest("button")
                            ) {
                              e.preventDefault();
                              return;
                            }
                            draggedRef.current = false;
                            setDraggingId(t.id);
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
                            "rounded-md border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 transition",
                            "hover:border-[var(--accent)]/50 hover:bg-[var(--surface)]",
                            draggingId === t.id && "opacity-50",
                            busyId === t.id && "opacity-60",
                            busyId === t.id
                              ? "cursor-wait"
                              : "cursor-grab active:cursor-grabbing",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/dev/support/${encodeURIComponent(t.id)}`}
                              className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-snug hover:text-[var(--accent)] hover:underline"
                              onClick={(e) => {
                                if (draggedRef.current) e.preventDefault();
                              }}
                            >
                              {t.summary}
                            </Link>
                            <Badge
                              variant={statusVariant(t.status)}
                              className="shrink-0"
                            >
                              {statusLabel(t.status)}
                            </Badge>
                          </div>
                          <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                            {t.email || "No email"}
                            {t.createdAt
                              ? ` · ${new Date(t.createdAt).toLocaleString()}`
                              : ""}
                          </p>
                          <div className="relative mt-2 border-t border-[var(--border)]/70 pt-2">
                            <button
                              type="button"
                              disabled={busyId === t.id}
                              draggable={false}
                              aria-haspopup="listbox"
                              aria-expanded={assignMenuId === t.id}
                              aria-label={
                                !isPlaceholderAssignee(
                                  t.assignedToUid,
                                  t.assignedToName,
                                ) && t.assignedToName
                                  ? `Assigned to ${t.assignedToName}. Change assignee`
                                  : "Assign developer"
                              }
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                openAssignMenu(t.id, e.currentTarget);
                              }}
                              className="flex w-full items-center gap-2 rounded-md text-left transition hover:bg-[var(--surface-panel)]/60 disabled:opacity-50"
                            >
                              {!isPlaceholderAssignee(
                                t.assignedToUid,
                                t.assignedToName,
                              ) &&
                              (t.assignedToUid || t.assignedToName) ? (
                                <>
                                  <ProfileAvatar
                                    name={
                                      t.assignedToName ||
                                      developerByUid.get(t.assignedToUid ?? "")
                                        ?.displayName ||
                                      "Developer"
                                    }
                                    photoURL={
                                      developerByUid.get(t.assignedToUid ?? "")
                                        ?.photoURL ?? null
                                    }
                                    seed={
                                      t.assignedToName ||
                                      developerByUid.get(t.assignedToUid ?? "")
                                        ?.displayName ||
                                      t.assignedToUid ||
                                      undefined
                                    }
                                    size="sm"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                                      Assigned
                                    </p>
                                    <p className="truncate text-xs font-medium text-[var(--foreground)]">
                                      {t.assignedToName ||
                                        developerByUid.get(t.assignedToUid ?? "")
                                          ?.displayName ||
                                        "Developer"}
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

                            {assignMenuId === t.id ? (
                              <div
                                ref={assignMenuRef}
                                className="absolute top-full left-0 z-30 mt-1 flex max-h-72 w-full min-w-[13rem] flex-col border border-[var(--border)] bg-[var(--surface-raised)] shadow-md"
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <div className="shrink-0 space-y-1 border-b border-[var(--border)] p-1.5">
                                  <input
                                    ref={assignSearchRef}
                                    type="search"
                                    value={assignQuery}
                                    onChange={(e) =>
                                      setAssignQuery(e.target.value)
                                    }
                                    onKeyDown={(e) => e.stopPropagation()}
                                    placeholder="Search developers…"
                                    aria-label="Search developers"
                                    className="w-full bg-[var(--input)] px-2 py-1.5 text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--accent)]"
                                  />
                                  {(() => {
                                    const q = assignQuery.trim().toLowerCase();
                                    const showUnassigned =
                                      !q || "unassigned".includes(q);
                                    return showUnassigned ? (
                                      <button
                                        type="button"
                                        role="option"
                                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-[var(--surface-panel)]"
                                        onClick={() => {
                                          void assignTicket(t, null, null);
                                          closeAssignMenu();
                                        }}
                                      >
                                        <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-[10px] text-[var(--muted)]">
                                          —
                                        </span>
                                        Unassigned
                                      </button>
                                    ) : null;
                                  })()}
                                </div>
                                <div
                                  role="listbox"
                                  className="min-h-0 flex-1 overflow-y-auto py-1"
                                >
                                  {(() => {
                                    const q = assignQuery.trim().toLowerCase();
                                    const match = (label: string) =>
                                      !q || label.toLowerCase().includes(q);
                                    const showMe =
                                      isDeveloper(profile) &&
                                      match(
                                        `me ${profile.displayName || ""} ${profile.email || ""}`,
                                      );
                                    const filtered = developers.filter(
                                      (d) =>
                                        d.uid !== profile?.uid &&
                                        match(
                                          `${d.displayName || ""} ${d.email || ""}`,
                                        ),
                                    );
                                    const none = !showMe && filtered.length === 0;
                                    return (
                                      <>
                                        {showMe && isDeveloper(profile) ? (
                                          <button
                                            type="button"
                                            role="option"
                                            aria-selected={
                                              t.assignedToUid === profile.uid
                                            }
                                            className={cn(
                                              "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-panel)]",
                                              t.assignedToUid === profile.uid &&
                                                "bg-[var(--accent)]/10",
                                            )}
                                            onClick={() => {
                                              void assignTicket(
                                                t,
                                                profile.uid,
                                                profile.displayName ||
                                                  profile.email,
                                              );
                                              closeAssignMenu();
                                            }}
                                          >
                                            <ProfileAvatar
                                              name={
                                                profile.displayName ||
                                                profile.email
                                              }
                                              photoURL={profile.photoURL}
                                              seed={
                                                profile.displayName ||
                                                profile.email
                                              }
                                              size="sm"
                                            />
                                            <span className="min-w-0 truncate">
                                              Me ·{" "}
                                              {profile.displayName ||
                                                profile.email}
                                            </span>
                                          </button>
                                        ) : null}
                                        {filtered.map((d) => (
                                          <button
                                            key={d.uid}
                                            type="button"
                                            role="option"
                                            aria-selected={
                                              t.assignedToUid === d.uid
                                            }
                                            className={cn(
                                              "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-[var(--surface-panel)]",
                                              t.assignedToUid === d.uid &&
                                                "bg-[var(--accent)]/10",
                                            )}
                                            onClick={() => {
                                              void assignTicket(
                                                t,
                                                d.uid,
                                                d.displayName || d.email,
                                              );
                                              closeAssignMenu();
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
                                        {none ? (
                                          <p className="px-2.5 py-3 text-center text-xs text-[var(--muted)]">
                                            No matches
                                          </p>
                                        ) : null}
                                      </>
                                    );
                                  })()}
                                </div>
                              </div>
                            ) : null}
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
    </div>
  );
}
