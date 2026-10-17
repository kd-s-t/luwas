"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CommandContentSkeleton } from "@/components/PageLoadSkeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  subscribeMySupportTickets,
  type SupportTicket,
  type SupportTicketStatus,
} from "@/lib/support/api";
import { cn } from "@/lib/utils";

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

type MySupportTicketsProps = {
  /** Base path for ticket detail links. */
  detailBase: "/admin/support" | "/support";
  /** Optional class on the outer list. */
  className?: string;
};

function newTicketHref(detailBase: MySupportTicketsProps["detailBase"]): string {
  return detailBase === "/admin/support"
    ? "/admin/support/new"
    : "/support#report";
}

export function MySupportTickets({
  detailBase,
  className,
}: MySupportTicketsProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = user?.uid?.trim() ?? "";
    if (!uid) {
      setRows([]);
      setReady(true);
      return;
    }
    setReady(false);
    return subscribeMySupportTickets(
      uid,
      (next) => {
        setRows(next);
        setReady(true);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setReady(true);
      },
    );
  }, [user?.uid]);

  const openCount = useMemo(
    () =>
      rows.filter((t) => t.status === "open" || t.status === "in_progress")
        .length,
    [rows],
  );

  if (!user) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Sign in to see support tickets you filed.
      </p>
    );
  }

  if (!ready) {
    return <CommandContentSkeleton />;
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-[var(--muted)]">
          {rows.length === 0
            ? "No tickets yet."
            : `${rows.length} ticket${rows.length === 1 ? "" : "s"}`}
          {openCount > 0 ? ` · ${openCount} open` : ""}
        </p>
        <Link
          href={newTicketHref(detailBase)}
          className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase hover:underline"
        >
          New ticket
        </Link>
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          <p>No tickets filed yet.</p>
          <Link
            href={newTicketHref(detailBase)}
            className="mt-2 inline-block font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase hover:underline"
          >
            New ticket
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {rows.map((t) => (
            <li key={t.id}>
              <Link
                href={`${detailBase}/${encodeURIComponent(t.id)}`}
                className="flex flex-col gap-1.5 px-3.5 py-3 transition hover:bg-[var(--surface-panel)]/60 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {t.summary}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[10px] tracking-wide text-[var(--muted)]">
                    {t.createdAt
                      ? new Date(t.createdAt).toLocaleString()
                      : t.id}
                    {t.assignedToName ? ` · ${t.assignedToName}` : ""}
                  </p>
                </div>
                <Badge
                  variant={statusVariant(t.status)}
                  className="w-fit shrink-0"
                >
                  {statusLabel(t.status)}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
