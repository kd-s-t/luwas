"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { MessageCircle, Trash2 } from "lucide-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  addReportComment,
  deleteReportComment,
  setReportReaction,
  subscribeReportComments,
  subscribeReportReactions,
} from "@/lib/reports/socialApi";
import {
  REACTION_META,
  type ReactionType,
  type ReportComment,
  type ReportReaction,
} from "@/lib/reports/socialTypes";
import type { HazardReport } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

type PublicReportCardProps = {
  report: HazardReport;
};

function statusVariant(
  status: HazardReport["status"],
): "default" | "outline" | "warn" | "danger" {
  if (status === "legit") return "default";
  if (status === "rejected" || status === "failed") return "danger";
  if (status === "needs_review" || status === "validating" || status === "queued")
    return "warn";
  return "outline";
}

export function PublicReportCard({ report }: PublicReportCardProps) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [reactions, setReactions] = useState<ReportReaction[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    return subscribeReportComments(report.id, setComments);
  }, [report.id]);

  useEffect(() => {
    return subscribeReportReactions(report.id, setReactions);
  }, [report.id]);

  const myReaction = useMemo(
    () => reactions.find((r) => r.uid === user?.uid) ?? null,
    [reactions, user?.uid],
  );

  const displayName =
    profile?.displayName ?? user?.email?.split("@")[0] ?? "User";
  const photoURL = profile?.photoURL ?? user?.photoURL ?? null;

  async function onReact(type: ReactionType) {
    if (!user) {
      setError("Sign in to react.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setReportReaction({
        reportId: report.id,
        uid: user.uid,
        displayName,
        photoURL,
        type,
        previous: myReaction,
        counts: report.reactionCounts,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not react");
    } finally {
      setBusy(false);
    }
  }

  async function onComment(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("Sign in to comment.");
      return;
    }
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      await addReportComment({
        reportId: report.id,
        uid: user.uid,
        displayName,
        photoURL,
        text,
        previousCount: report.commentCount,
      });
      setDraft("");
      setShowComments(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not comment");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteComment(comment: ReportComment) {
    if (!user || comment.uid !== user.uid) return;
    setBusy(true);
    setError(null);
    try {
      await deleteReportComment({
        reportId: report.id,
        commentId: comment.id,
        previousCount: report.commentCount,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="border border-[var(--border)] bg-[var(--surface)]">
      <header className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-3">
        <ProfileAvatar
          name={report.citizenName}
          photoURL={report.citizenPhotoURL}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{report.citizenName}</p>
            <Badge variant={statusVariant(report.status)}>{report.status}</Badge>
            <Badge variant="outline">{report.hazardHint}</Badge>
          </div>
          <p className="text-xs text-[var(--muted)]">
            {report.citizenPurok} ·{" "}
            {new Date(report.createdAt).toLocaleString()}
          </p>
        </div>
      </header>

      <div className="px-4 py-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
          {report.title}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)] whitespace-pre-wrap">
          {report.notes}
        </p>
      </div>

      <div className="border-y border-[var(--border)] bg-[var(--surface-panel)]">
        {report.mediaType === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={report.mediaUrl}
            alt=""
            className="max-h-[420px] w-full object-contain"
          />
        ) : (
          <video
            src={report.mediaUrl}
            className="max-h-[420px] w-full"
            controls
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        {REACTION_META.map((r) => {
          const count = report.reactionCounts[r.type] ?? 0;
          const active = myReaction?.type === r.type;
          return (
            <button
              key={r.type}
              type="button"
              disabled={busy}
              onClick={() => void onReact(r.type)}
              className={cn(
                "border px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase transition",
                active
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
              )}
            >
              {r.label}
              {count ? ` · ${count}` : ""}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase hover:text-[var(--accent)]"
        >
          <MessageCircle className="size-3.5" aria-hidden />
          {report.commentCount} comment{report.commentCount === 1 ? "" : "s"}
        </button>
      </div>

      {showComments ? (
        <div className="border-t border-[var(--border)] px-4 py-3">
          <ul className="space-y-3">
            {comments.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">No comments yet.</li>
            ) : (
              comments.map((c) => (
                <li key={c.id} className="flex gap-2">
                  <ProfileAvatar
                    name={c.displayName}
                    photoURL={c.photoURL}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{c.displayName}</p>
                        <p className="font-mono text-[9px] text-[var(--muted)] uppercase">
                          {c.createdAt
                            ? new Date(c.createdAt).toLocaleString()
                            : ""}
                        </p>
                      </div>
                      {user?.uid === c.uid ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void onDeleteComment(c)}
                          className="p-1 text-[var(--muted)] transition hover:text-[var(--danger)]"
                          aria-label="Delete comment"
                          title="Delete comment"
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-wrap">{c.text}</p>
                  </div>
                </li>
              ))
            )}
          </ul>

          {user ? (
            <form onSubmit={onComment} className="mt-3 flex items-start gap-2">
              <ProfileAvatar
                name={displayName}
                photoURL={photoURL}
                size="sm"
              />
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder="Add a comment…"
                disabled={busy}
                className="min-h-10 flex-1 resize-y border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <Button
                type="submit"
                size="sm"
                disabled={busy || !draft.trim()}
              >
                Post
              </Button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">
              <Link href="/login/citizen" className="text-[var(--accent)] underline-offset-2 hover:underline">
                Sign in
              </Link>{" "}
              to comment or react.
            </p>
          )}
        </div>
      ) : null}

      {error ? (
        <p className="px-4 pb-3 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </article>
  );
}
