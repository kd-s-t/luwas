"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  officerScopeBarangay,
  subscribePendingAccounts,
  type PendingAccount,
} from "@/lib/auth/accountValidation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isOfficer } from "@/lib/auth/types";
import {
  buildOfficerNotifications,
  loadReadIds,
  saveReadIds,
  type OfficerNotification,
} from "@/lib/notifications/officerInbox";
import { subscribeAllReports } from "@/lib/reports/api";
import {
  reportInScope,
  scopeForProfile,
} from "@/lib/reports/barangayScope";
import type { HazardReport } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

type CommandNotificationsProps = {
  /** Sidebar footer sits at the bottom — open the panel upward. */
  placement?: "below" | "above";
};

export function CommandNotifications({
  placement = "below",
}: CommandNotificationsProps) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<PendingAccount[]>([]);
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [panelPos, setPanelPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const barangay = isOfficer(profile) ? officerScopeBarangay(profile) : "";
  const areaId = isOfficer(profile)
    ? profile.areaId ?? profile.activeBarangayId
    : null;
  const reportScope = useMemo(() => scopeForProfile(profile), [profile]);
  const uid = profile?.uid ?? "";

  useEffect(() => {
    if (!uid) {
      setReadIds(new Set());
      return;
    }
    setReadIds(loadReadIds(uid));
  }, [uid]);

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile) || !barangay) {
      setPending([]);
      return;
    }
    return subscribePendingAccounts(barangay, setPending, undefined, areaId);
  }, [profile, barangay, areaId]);

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile)) {
      setReports([]);
      return;
    }
    return subscribeAllReports((rows) => {
      setReports(rows.filter((r) => reportInScope(r, reportScope)));
    });
  }, [profile, reportScope]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 8;
      const width = Math.min(352, window.innerWidth - 24);
      if (placement === "above") {
        setPanelPos({
          bottom: window.innerHeight - r.top + gap,
          left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
          width,
          maxHeight: Math.max(160, r.top - gap - 12),
        });
      } else {
        setPanelPos({
          top: r.bottom + gap,
          left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)),
          width,
          maxHeight: Math.max(160, window.innerHeight - r.bottom - gap - 12),
        });
      }
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, placement]);

  const items = useMemo(
    () => buildOfficerNotifications({ pending, reports }),
    [pending, reports],
  );

  const unread = useMemo(
    () => items.filter((n) => !readIds.has(n.id)),
    [items, readIds],
  );

  function persist(next: Set<string>) {
    setReadIds(next);
    if (uid) saveReadIds(uid, next);
  }

  function markAllRead() {
    const next = new Set(readIds);
    for (const n of items) next.add(n.id);
    persist(next);
  }

  function markRead(n: OfficerNotification) {
    if (readIds.has(n.id)) return;
    const next = new Set(readIds);
    next.add(n.id);
    persist(next);
  }

  if (!isOfficer(profile) || !isAccountActive(profile)) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative inline-flex size-9 items-center justify-center border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]",
          open && "border-[var(--accent)] text-[var(--accent)]",
        )}
        aria-label={
          unread.length > 0
            ? `Notifications · ${unread.length} unread`
            : "Notifications"
        }
        aria-expanded={open}
      >
        <Bell className="size-4" strokeWidth={2} />
        {unread.length > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[1.1rem] rounded-sm bg-[var(--accent)] px-1 py-px text-center text-[9px] font-semibold tabular-nums text-[var(--on-accent)]">
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        ) : null}
      </button>

      {open && panelPos ? (
        <div
          className="fixed z-[100] flex flex-col overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--foreground)] shadow-[0_12px_40px_rgba(31,33,38,0.14)]"
          style={{
            left: panelPos.left,
            width: panelPos.width,
            maxHeight: panelPos.maxHeight,
            ...(panelPos.bottom != null
              ? { bottom: panelPos.bottom }
              : { top: panelPos.top }),
          }}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2.5">
            <div>
              <p className="font-mono text-[9px] tracking-[0.18em] text-[var(--accent)] uppercase">
                Notifications
              </p>
              <p className="text-xs text-[var(--muted)]">
                {unread.length > 0
                  ? `${unread.length} unread`
                  : items.length > 0
                    ? "All caught up"
                    : "No alerts"}
              </p>
            </div>
            {items.length > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--accent)]"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          {items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-[var(--muted)]">
              No pending registrations or reports awaiting review.
            </p>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto divide-y divide-[var(--border)]">
              {items.map((n) => {
                const isUnread = !readIds.has(n.id);
                return (
                  <li key={n.id}>
                    <Link
                      href={n.href}
                      onClick={() => {
                        markRead(n);
                        setOpen(false);
                      }}
                      className={cn(
                        "block px-3 py-2.5 transition hover:bg-[var(--surface-panel)]",
                        isUnread && "bg-[var(--accent)]/[0.04]",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {isUnread ? (
                          <span
                            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--accent)]"
                            aria-hidden
                          />
                        ) : (
                          <span className="mt-1.5 size-1.5 shrink-0" aria-hidden />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug">
                            {n.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-snug text-[var(--muted)] break-words">
                            {n.body}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
