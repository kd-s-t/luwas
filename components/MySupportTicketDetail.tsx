"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CommandContentSkeleton } from "@/components/PageLoadSkeleton";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isPlaceholderAssignee,
  subscribeMySupportTickets,
  type SupportTicket,
  type SupportTicketStatus,
} from "@/lib/support/api";
import { isSupportVideoUrl } from "@/lib/support/upload";
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

function SupportMedia({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {urls.map((src) => (
        <li key={src}>
          {isSupportVideoUrl(src) ? (
            <video
              src={src}
              controls
              playsInline
              className="max-h-64 max-w-full rounded-xl border border-[var(--border)]"
            />
          ) : (
            <a href={src} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="max-h-48 max-w-full rounded-xl border border-[var(--border)] object-contain"
              />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

type MySupportTicketDetailProps = {
  ticketId: string;
  backHref: "/admin/support" | "/support";
};

export function MySupportTicketDetail({
  ticketId,
  backHref,
}: MySupportTicketDetailProps) {
  const { user, profile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const uid = user?.uid?.trim() ?? "";
    if (!uid) {
      setTickets([]);
      setReady(true);
      return;
    }
    return subscribeMySupportTickets(
      uid,
      (rows) => {
        setTickets(rows);
        setReady(true);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setReady(true);
      },
    );
  }, [user?.uid]);

  const selected = useMemo(
    () => tickets.find((t) => t.id === ticketId) ?? null,
    [tickets, ticketId],
  );

  if (!user) {
    return (
      <p className="p-6 text-sm text-[var(--muted)]">
        Sign in to view this ticket.
      </p>
    );
  }

  if (!ready) {
    return <CommandContentSkeleton fill />;
  }

  if (error) {
    return (
      <p className="p-6 text-sm text-[var(--danger)]" role="alert">
        {error}
      </p>
    );
  }

  if (!selected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Ticket not found
        </p>
        <p className="max-w-sm text-sm text-[var(--muted)]">
          This ticket is missing, or it belongs to another account.
        </p>
        <Link
          href={backHref}
          className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase hover:underline"
        >
          ← My tickets
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[var(--surface)]">
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="mb-2">
          <Link
            href={backHref}
            className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--accent)]"
          >
            ← My tickets
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-semibold sm:text-lg">
            {selected.summary}
          </h1>
          <Badge variant={statusVariant(selected.status)}>
            {statusLabel(selected.status)}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {!isPlaceholderAssignee(
            selected.assignedToUid,
            selected.assignedToName,
          ) && selected.assignedToName
            ? selected.assignedToName
            : "Unassigned"}
          {selected.createdAt
            ? ` · filed ${new Date(selected.createdAt).toLocaleString()}`
            : ""}
        </p>
      </div>

      <div className="space-y-6 px-4 py-5 sm:px-5">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Details</h2>
          <p className="text-sm whitespace-pre-wrap text-[var(--muted)]">
            {selected.details || "—"}
          </p>
          <SupportMedia urls={selected.mediaUrls} />
        </section>

        {selected.resolutionNote ? (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3.5 py-3">
            <h2 className="mb-1 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Resolution
            </h2>
            <p className="text-sm whitespace-pre-wrap">
              {selected.resolutionNote}
            </p>
            {selected.resolvedAt ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {selected.resolvedByName
                  ? `${selected.resolvedByName} · `
                  : ""}
                {new Date(selected.resolvedAt).toLocaleString()}
              </p>
            ) : null}
          </section>
        ) : null}

        <section>
          <h2 className="mb-2 text-sm font-semibold">Updates</h2>
          {selected.messages.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No developer replies yet. Status changes show above.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {selected.messages.map((m) => {
                const mine =
                  Boolean(user?.uid) && m.authorUid === user?.uid;
                const name = mine ? "You" : m.authorName || "Team";
                const photo =
                  m.authorPhotoURL ||
                  (mine ? (profile?.photoURL ?? null) : null);
                const avatar = (
                  <ProfileAvatar
                    name={mine ? name : m.authorName || "Team"}
                    photoURL={photo}
                    seed={m.authorUid || m.authorName}
                    size="sm"
                    className="mt-0.5"
                  />
                );
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "flex w-full items-start gap-2",
                      mine ? "justify-end" : "justify-start",
                    )}
                  >
                    {!mine ? avatar : null}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl border px-3.5 py-3",
                        mine
                          ? "border-[var(--accent)]/30 bg-[var(--accent)]/10"
                          : "border-[var(--border)] bg-[var(--surface-raised)]",
                      )}
                    >
                      <p
                        className={cn(
                          "font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase",
                          mine && "text-right",
                        )}
                      >
                        {name}
                        {m.createdAt
                          ? ` · ${new Date(m.createdAt).toLocaleString()}`
                          : ""}
                      </p>
                      {m.body ? (
                        <p className="mt-1.5 text-sm whitespace-pre-wrap">
                          {m.body}
                        </p>
                      ) : null}
                      <SupportMedia urls={m.mediaUrls} />
                    </div>
                    {mine ? avatar : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
