"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isDeveloper } from "@/lib/auth/types";
import {
  buildDeveloperNotifications,
  loadDevReadIds,
  saveDevReadIds,
  type DeveloperNotification,
} from "@/lib/notifications/developerInbox";
import {
  subscribeSupportTickets,
  type SupportTicket,
} from "@/lib/support/api";
import { cn } from "@/lib/utils";

type DeveloperNotificationsProps = {
  placement?: "below" | "above";
  /** Dark sidebar / mobile chrome. */
  tone?: "light" | "dark";
};

export function DeveloperNotifications({
  placement = "below",
  tone = "dark",
}: DeveloperNotificationsProps) {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [open, setOpen] = useState(false);
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

  const uid = profile?.uid ?? "";

  useEffect(() => {
    if (!isDeveloper(profile) || !isAccountActive(profile)) {
      setTickets([]);
      return;
    }
    return subscribeSupportTickets((rows) => setTickets(rows));
  }, [profile]);

  useEffect(() => {
    if (!uid) {
      setReadIds(new Set());
      return;
    }
    setReadIds(loadDevReadIds(uid));
  }, [uid]);

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
          left: Math.max(
            8,
            Math.min(r.right - width, window.innerWidth - width - 8),
          ),
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
    () => buildDeveloperNotifications({ tickets, uid }),
    [tickets, uid],
  );

  const unread = useMemo(
    () => items.filter((n) => !readIds.has(n.id)),
    [items, readIds],
  );

  function persist(next: Set<string>) {
    setReadIds(next);
    if (uid) saveDevReadIds(uid, next);
  }

  function markAllRead() {
    const next = new Set(readIds);
    for (const n of items) next.add(n.id);
    persist(next);
  }

  function markRead(n: DeveloperNotification) {
    if (readIds.has(n.id)) return;
    const next = new Set(readIds);
    next.add(n.id);
    persist(next);
  }

  if (!isDeveloper(profile) || !isAccountActive(profile)) return null;

  const dark = tone === "dark";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative inline-flex size-9 items-center justify-center transition",
          dark
            ? cn(
                "rounded-md text-white/55 hover:bg-white/10 hover:text-white",
                open && "bg-white/10 text-white",
              )
            : cn(
                "border border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]",
                open && "border-[var(--accent)] text-[var(--accent)]",
              ),
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
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] rounded-sm bg-[#c72929] px-1 py-px text-center text-[9px] font-semibold tabular-nums text-white">
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
              No open support tickets.
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
                          <span
                            className="mt-1.5 size-1.5 shrink-0"
                            aria-hidden
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-snug">
                            {n.title}
                          </p>
                          <p className="mt-0.5 text-xs leading-snug break-words text-[var(--muted)]">
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
