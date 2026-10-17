"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Heart, MessageCircle, Tornado, Trash2 } from "lucide-react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
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
  EMPTY_REACTION_COUNTS,
  type ReactionCounts,
  type ReactionType,
  type ReportComment,
  type ReportReaction,
} from "@/lib/reports/socialTypes";
import { formatDispatchListLine } from "@/lib/reports/dispatchLog";
import {
  displayReportNotes,
  displayVoiceNoteLabel,
} from "@/lib/reports/displayNotes";
import { formatTrustBreakdown } from "@/lib/reports/trustScore";
import { hazardHintLabel, type HazardReport } from "@/lib/reports/types";
import { activityForReport } from "@/lib/workspace/incidentDerived";
import { cn } from "@/lib/utils";

type PublicReportCardProps = {
  report: HazardReport;
  /** When true, open comments and live social listeners immediately. */
  expandSocial?: boolean;
};

function countsFromReactions(
  reactions: ReportReaction[],
  fallback: ReactionCounts,
): ReactionCounts {
  if (reactions.length === 0) return { ...fallback };
  const next = { ...EMPTY_REACTION_COUNTS };
  for (const r of reactions) {
    next[r.type] = (next[r.type] ?? 0) + 1;
  }
  return next;
}

export function PublicReportCard({
  report,
  expandSocial = false,
}: PublicReportCardProps) {
  const { user, profile } = useAuth();
  const [commentsOpen, setCommentsOpen] = useState(expandSocial);
  const [liveSocial, setLiveSocial] = useState(expandSocial || Boolean(user));
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [reactions, setReactions] = useState<ReportReaction[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) setLiveSocial(true);
  }, [user]);

  useEffect(() => {
    if (!liveSocial && !commentsOpen) return;
    return subscribeReportComments(report.id, setComments);
  }, [report.id, liveSocial, commentsOpen]);

  useEffect(() => {
    if (!liveSocial) return;
    return subscribeReportReactions(report.id, setReactions);
  }, [report.id, liveSocial]);

  const myReaction = useMemo(
    () => reactions.find((r) => r.uid === user?.uid) ?? null,
    [reactions, user?.uid],
  );

  const liveCounts = useMemo(
    () =>
      liveSocial
        ? countsFromReactions(reactions, report.reactionCounts)
        : { ...report.reactionCounts },
    [liveSocial, reactions, report.reactionCounts],
  );

  const likeCount = liveCounts.like;
  const liked = myReaction?.type === "like";
  const commentCount = liveSocial
    ? comments.length
    : report.commentCount ?? 0;

  const displayName =
    profile?.displayName ?? user?.email?.split("@")[0] ?? "User";
  const photoURL = profile?.photoURL ?? user?.photoURL ?? null;

  function ensureLiveSocial() {
    setLiveSocial(true);
  }

  async function onLike() {
    if (!user) {
      setError("Sign in to like.");
      return;
    }
    ensureLiveSocial();
    setBusy(true);
    setError(null);
    try {
      await setReportReaction({
        reportId: report.id,
        uid: user.uid,
        displayName,
        photoURL,
        type: "like",
        previous: myReaction,
        counts: liveCounts,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not like");
    } finally {
      setBusy(false);
    }
  }

  async function onReactExtra(type: Exclude<ReactionType, "like">) {
    if (!user) {
      setError("Sign in to react.");
      return;
    }
    ensureLiveSocial();
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
        counts: liveCounts,
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
    ensureLiveSocial();
    setCommentsOpen(true);
    setBusy(true);
    setError(null);
    try {
      await addReportComment({
        reportId: report.id,
        uid: user.uid,
        displayName,
        photoURL,
        text,
        previousCount: Math.max(report.commentCount, comments.length),
      });
      setDraft("");
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
        previousCount: Math.max(report.commentCount, comments.length),
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
            <ReportStatusBadge status={report.status} />
            <Badge
              variant="outline"
              className="inline-flex items-center gap-1"
            >
              {report.hazardHint === "typhoon" ? (
                <Tornado
                  className="size-3 shrink-0 text-[#1d4ed8]"
                  strokeWidth={2.5}
                  aria-hidden
                />
              ) : null}
              {hazardHintLabel(report.hazardHint)}
            </Badge>
          </div>
          <p className="text-xs text-[var(--muted)]">
            {report.citizenPurok} ·{" "}
            {new Date(report.createdAt).toLocaleString()}
          </p>
          {(report.mediaSource ||
            report.locationLabel ||
            report.device ||
            report.ipAddress ||
            report.trustScore != null) && (
            <p className="mt-1 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
              {report.mediaSource === "mobile-camera"
                ? "Field camera"
                : report.mediaSource === "desktop-file"
                  ? "Desk upload"
                  : null}
              {report.mediaSource &&
              (report.locationLabel || report.device || report.ipAddress)
                ? " · "
                : null}
              {report.locationLabel ? (
                report.lat != null && report.lng != null ? (
                  <a
                    href={`https://www.google.com/maps?q=${report.lat},${report.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline-offset-2 hover:text-[var(--accent)] hover:underline"
                  >
                    Loc {report.locationLabel}
                  </a>
                ) : (
                  <span>Loc {report.locationLabel}</span>
                )
              ) : null}
              {report.locationLabel && (report.device || report.ipAddress)
                ? " · "
                : null}
              {report.device ?? null}
              {report.device && report.ipAddress ? " · " : null}
              {report.ipAddress ? `IP ${report.ipAddress}` : null}
              {report.trustScore != null
                ? `${report.mediaSource || report.locationLabel || report.device || report.ipAddress ? " · " : ""}Trust ${report.trustScore}%`
                : null}
            </p>
          )}
        </div>
      </header>

      <div className="px-4 py-3">
        <p className="break-all font-mono text-[11px] tracking-wide text-[var(--muted)] tabular-nums">
          {report.id}
        </p>
        <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
          {report.title}
        </h2>
        {displayReportNotes(report.notes) ? (
          <p className="mt-1 text-sm whitespace-pre-wrap text-[var(--muted)]">
            {displayReportNotes(report.notes)}
          </p>
        ) : null}

        {expandSocial ? (
          <dl className="mt-3 grid gap-2 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Place
              </dt>
              <dd className="mt-0.5 text-[var(--foreground)]">
                {[report.citizenPurok, report.barangay, report.lgu]
                  .filter(Boolean)
                  .join(" · ") || "Not set"}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Received
              </dt>
              <dd className="mt-0.5 text-[var(--foreground)]">
                {new Date(report.createdAt).toLocaleString()}
              </dd>
            </div>
            {report.validatedAt ? (
              <div>
                <dt className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                  Validated
                </dt>
                <dd className="mt-0.5 text-[var(--foreground)]">
                  {new Date(report.validatedAt).toLocaleString()}
                </dd>
              </div>
            ) : null}
            {report.investigatorName || report.investigatorUid ? (
              <div>
                <dt className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                  Investigator
                </dt>
                <dd className="mt-0.5 text-[var(--foreground)]">
                  {report.investigatorName || report.investigatorUid}
                </dd>
              </div>
            ) : null}
            {report.lat != null && report.lng != null ? (
              <div className="sm:col-span-2">
                <dt className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                  Coordinates
                </dt>
                <dd className="mt-0.5">
                  <a
                    href={`https://www.google.com/maps?q=${report.lat},${report.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
                    {report.locationAccuracyM != null
                      ? ` · ±${Math.round(report.locationAccuracyM)} m`
                      : ""}
                  </a>
                </dd>
              </div>
            ) : null}
            {report.trustScore != null ? (
              <div className="sm:col-span-2">
                <dt className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                  Trust
                </dt>
                <dd className="mt-0.5 text-[var(--foreground)]">
                  {report.trustScore}%
                  {report.trustBreakdown
                    ? ` · ${formatTrustBreakdown(report.trustBreakdown)}`
                    : ""}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        {report.aiReason ? (
          <div className="mt-3 border border-dashed border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5">
            <p className="font-mono text-[10px] tracking-wider text-[var(--warn)] uppercase">
              AI validation
              {report.aiSource ? ` · ${report.aiSource}` : ""}
              {report.aiConfidence != null
                ? ` · ${Math.round(report.aiConfidence * 100)}%`
                : ""}
              {report.aiModel ? ` · ${report.aiModel}` : ""}
            </p>
            <p className="mt-1 text-sm text-[var(--foreground)]">
              {report.aiReason}
            </p>
            {report.vertexClass ? (
              <p className="mt-1 font-mono text-[10px] text-[var(--muted)] uppercase">
                Vertex · {report.vertexClass}
                {report.vertexConfidence != null
                  ? ` · ${Math.round(report.vertexConfidence * 100)}%`
                  : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        {report.voiceUrl || report.voiceTranscript ? (
          <div className="mt-3 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5">
            <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Voice note
              {(() => {
                const when = displayVoiceNoteLabel(report.voiceNoteLabel);
                return when ? ` · ${when}` : "";
              })()}
            </p>
            {report.voiceUrl ? (
              <audio
                controls
                preload="metadata"
                src={report.voiceUrl}
                className="mt-2 w-full"
              />
            ) : null}
            {report.voiceTranscript ? (
              <p className="mt-2 text-sm whitespace-pre-wrap text-[var(--muted)]">
                {report.voiceTranscript}
              </p>
            ) : null}
          </div>
        ) : null}

        {report.dispatchLog || report.status === "legit" ? (
          <div className="mt-3 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5">
            <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Dispatch activity
            </p>
            {report.dispatchLog ? (
              <ul className="mt-1.5 space-y-1 text-xs text-[var(--foreground)]">
                {report.dispatchLog.called.length > 0 ? (
                  <li>
                    <span className="text-[var(--muted)]">Called · </span>
                    {report.dispatchLog.called.join(", ")}
                  </li>
                ) : null}
                {report.dispatchLog.texted.length > 0 ? (
                  <li>
                    <span className="text-[var(--muted)]">Texted · </span>
                    {report.dispatchLog.texted.join(", ")}
                  </li>
                ) : null}
                {report.dispatchLog.called.length === 0 &&
                report.dispatchLog.texted.length === 0 ? (
                  <li>{formatDispatchListLine(report.dispatchLog)}</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                Verified · waiting for responder call / SMS log.
              </p>
            )}
            {expandSocial ? (
              <ul className="mt-2 space-y-1 border-t border-[var(--border)] pt-2">
                {activityForReport(report)
                  .filter(
                    (e) =>
                      e.id.includes("-call") ||
                      e.id.includes("-sms") ||
                      e.id.includes("-dispatch") ||
                      e.id.includes("-ai") ||
                      e.id.includes("-status"),
                  )
                  .map((e) => (
                    <li key={e.id} className="text-[11px] text-[var(--muted)]">
                      <span className="font-medium text-[var(--foreground)]">
                        {e.title}
                      </span>
                      {e.detail ? ` · ${e.detail}` : null}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-y border-[var(--border)] bg-[var(--surface-panel)]">
        {report.mediaType === "photo" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={report.mediaUrl}
            alt={
              report.title?.trim() ||
              `${hazardHintLabel(report.hazardHint)} report photo`
            }
            className="max-h-[420px] w-full object-contain"
            loading="lazy"
          />
        ) : (
          <video
            src={report.mediaUrl}
            className="max-h-[420px] w-full"
            controls
            preload="metadata"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onLike()}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition",
            liked
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
              : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
          )}
          aria-pressed={liked}
        >
          <Heart
            className={cn("size-4", liked && "fill-current")}
            aria-hidden
          />
          Like{likeCount ? ` · ${likeCount}` : ""}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onReactExtra("helpful")}
          className={cn(
            "rounded-xl border px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase transition",
            myReaction?.type === "helpful"
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
              : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]",
          )}
        >
          Helpful{liveCounts.helpful ? ` · ${liveCounts.helpful}` : ""}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onReactExtra("concern")}
          className={cn(
            "rounded-xl border px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase transition",
            myReaction?.type === "concern"
              ? "border-[var(--warn)] bg-[var(--warn)]/15 text-[var(--warn)]"
              : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--warn)]",
          )}
        >
          Concern{liveCounts.concern ? ` · ${liveCounts.concern}` : ""}
        </button>
        <button
          type="button"
          onClick={() => {
            setCommentsOpen((v) => !v);
            setLiveSocial(true);
          }}
          className="ml-auto inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--accent)]"
        >
          <MessageCircle className="size-3.5" aria-hidden />
          {commentCount} comment{commentCount === 1 ? "" : "s"}
          {commentsOpen ? " · hide" : " · show"}
        </button>
      </div>

      {commentsOpen ? (
        <div className="px-4 py-3">
          <ul className="space-y-3">
            {comments.length === 0 ? (
              <li className="text-sm text-[var(--muted)]">
                No comments yet — be the first.
              </li>
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
            <form onSubmit={onComment} className="mt-4 flex items-start gap-2">
              <ProfileAvatar name={displayName} photoURL={photoURL} size="sm" />
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                placeholder="Write a comment…"
                aria-label="Write a comment"
                disabled={busy}
                aria-invalid={!!error}
                aria-describedby={error ? "comment-error" : undefined}
                className="min-h-10 flex-1 resize-y border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
                Post
              </Button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">
              <Link
                href="/login/citizen"
                className="text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Sign in
              </Link>{" "}
              to like or comment.
            </p>
          )}
        </div>
      ) : !user ? (
        <p className="px-4 py-3 text-sm text-[var(--muted)]">
          <Link
            href="/login/citizen"
            className="text-[var(--accent)] underline-offset-2 hover:underline"
          >
            Sign in
          </Link>{" "}
          to like or comment.
        </p>
      ) : null}

      {error ? (
        <p
          id="comment-error"
          className="px-4 pb-3 text-sm text-[var(--danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </article>
  );
}
