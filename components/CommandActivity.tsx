"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FadeIn } from "@/components/motion/primitives";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import {
  listAssistanceCommitments,
  type AssistanceCommitment,
} from "@/lib/workspace/assistanceCommitments";
import {
  buildActivityBoard,
  type ActivityFilter,
  type ActivityTimelineStep,
  type FollowUpItem,
  type InProgressDelivery,
} from "@/lib/workspace/activityBoard";
import type {
  CompletedDelivery,
  OtherUpdate,
} from "@/lib/workspace/assistancePlan";
import { cn } from "@/lib/utils";

function tagTone(
  tone: FollowUpItem["tags"][number]["tone"] | OtherUpdate["tags"][number]["tone"],
) {
  if (tone === "critical") {
    return "bg-[#c72929]/10 text-[#c72929] ring-[#c72929]/20";
  }
  if (tone === "warn") {
    return "bg-[#f59e0b]/12 text-[#b45309] ring-[#f59e0b]/25";
  }
  if (tone === "info") {
    return "bg-[#3b6fb6]/10 text-[#2f5f9e] ring-[#3b6fb6]/20";
  }
  return "bg-[var(--foreground)]/5 text-[var(--muted)] ring-[var(--border)]";
}

function Timeline({ steps }: { steps: ActivityTimelineStep[] }) {
  let progressTo = 0;
  const activeIndex = steps.findIndex((s) => s.state === "active");
  if (activeIndex >= 0) {
    progressTo = activeIndex;
  } else {
    for (let i = 0; i < steps.length; i++) {
      if (steps[i]?.state === "done") progressTo = i;
    }
  }

  return (
    <div className="mt-4 overflow-x-auto pb-1">
      <ol className="mx-auto grid min-w-[22rem] grid-cols-4 gap-0 px-1">
        {steps.map((step) => {
          const done = step.state === "done";
          const active = step.state === "active";
          return (
            <li
              key={`${step.id}-label`}
              className="min-w-0 px-1 text-center"
            >
              <p
                className={cn(
                  "text-[11px] font-semibold sm:text-[12px]",
                  active
                    ? "text-[#2f5f9e]"
                    : done
                      ? "text-[#16794c]"
                      : "text-[var(--muted)]",
                )}
              >
                {step.label}
              </p>
            </li>
          );
        })}
        <li className="relative col-span-4 mt-1.5 mb-1.5 h-6" aria-hidden>
          <span className="absolute top-1/2 right-[12.5%] left-[12.5%] h-0.5 -translate-y-1/2 bg-[var(--border)]" />
          <span
            className="absolute top-1/2 left-[12.5%] h-0.5 -translate-y-1/2 bg-[#86efac]"
            style={{
              width:
                steps.length <= 1
                  ? "0%"
                  : `${(progressTo / (steps.length - 1)) * 75}%`,
            }}
          />
          <ol className="relative z-[1] grid h-full grid-cols-4">
            {steps.map((step) => {
              const done = step.state === "done";
              const active = step.state === "active";
              return (
                <li
                  key={`${step.id}-dot`}
                  className="flex items-center justify-center"
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      done && "bg-[#16794c] text-white",
                      active &&
                        "bg-[#2f5f9e] text-white ring-4 ring-[#2f5f9e]/15",
                      !done &&
                        !active &&
                        "bg-white text-[var(--muted)] ring-1 ring-[var(--border)]",
                    )}
                  >
                    {done ? "✓" : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </li>
        {steps.map((step) => (
          <li
            key={`${step.id}-time`}
            className="min-w-0 px-1 text-center"
          >
            <p className="text-[10px] leading-tight text-[var(--muted)] sm:text-[11px]">
              {step.timeLabel}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FollowUpCard({ item }: { item: FollowUpItem }) {
  return (
    <article className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag.label}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1",
                  tagTone(tag.tone),
                )}
              >
                {tag.label}
              </span>
            ))}
          </div>
          <h3 className="mt-2 text-base font-semibold tracking-tight">
            {item.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {item.detail}
          </p>
          <p className="mt-2 text-[12px] font-medium text-[#c72929]">
            {item.dueLine}
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-[12px] text-[var(--muted)]">{item.timeLabel}</p>
          <p className="mt-0.5 text-[12px] font-medium text-[var(--foreground)]">
            {item.metaLabel}
          </p>
          <Link
            href={item.ctaHref}
            className="mt-3 inline-flex rounded-xl bg-[#c72929] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#9e1a1a]"
          >
            {item.ctaLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}

function InProgressCard({ item }: { item: InProgressDelivery }) {
  return (
    <article className="rounded-2xl border border-[#93c5fd]/70 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-[var(--foreground)]">
            {item.place} · {item.incidentCode}
          </h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Relief assistance · {item.teamLabel}
          </p>
        </div>
        <span className="rounded-full bg-[#eff6ff] px-2.5 py-0.5 text-[11px] font-semibold text-[#2f5f9e] ring-1 ring-[#93c5fd]/70">
          {item.statusBadge}
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
        {item.supplyLine}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-[var(--muted)]">
        {item.summaryLine}
      </p>
      <Timeline steps={item.steps} />
      <p className="mt-4 rounded-xl border border-[#93c5fd]/60 bg-[#eff6ff] px-3 py-2.5 text-sm leading-relaxed text-[#2f5f9e]">
        {item.alertLine}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-[var(--muted)]">
          {item.teamLabel} · {item.vehicleLabel} · {item.officerLabel}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={item.detailsHref}
            className="inline-flex rounded-xl bg-[#2f5f9e] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#244a7c]"
          >
            View delivery details
          </Link>
          <Link
            href={item.detailsHref}
            className="inline-flex rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
          >
            Request update
          </Link>
        </div>
      </div>
    </article>
  );
}

function CompletedCard({ item }: { item: CompletedDelivery }) {
  return (
    <article className="rounded-2xl border border-[#86efac]/50 bg-[#f0fdf4]/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-[var(--foreground)]">
            {item.place} · {item.incidentCode}
          </h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Relief assistance · {item.teamLabel}
          </p>
        </div>
        <span className="rounded-full bg-[#ecfdf3] px-2.5 py-0.5 text-[11px] font-semibold text-[#16794c] ring-1 ring-[#86efac]/60">
          Delivered
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
        {item.supplyLine}
      </p>
      <p className="mt-1 text-[12px] text-[var(--muted)]">
        Delivered at {item.deliveredAt}
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          {item.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.mediaUrl}
              alt=""
              className="size-12 rounded-lg object-cover ring-1 ring-[var(--border)]"
            />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-lg bg-[var(--foreground)]/5 text-[10px] text-[var(--muted)] ring-1 ring-[var(--border)]">
              Evidence
            </div>
          )}
          {item.evidenceExtra > 0 ? (
            <span className="flex size-12 items-center justify-center rounded-lg bg-[var(--foreground)]/5 text-xs font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
              +{item.evidenceExtra}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={item.detailsHref}
            className="inline-flex rounded-xl border border-[#93c5fd] bg-white px-3 py-2 text-sm font-medium text-[#2f5f9e] transition hover:border-[#3b6fb6]"
          >
            View delivery evidence
          </Link>
          <Link
            href={item.detailsHref}
            className="inline-flex rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
          >
            View details
          </Link>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[var(--muted)]">
        {item.teamLabel} · {item.vehicleLabel} · {item.officerLabel}
      </p>
    </article>
  );
}

function OtherUpdateCard({ item }: { item: OtherUpdate }) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag.label}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1",
                  tagTone(tag.tone),
                )}
              >
                {tag.label}
              </span>
            ))}
          </div>
          <h3 className="mt-2 text-base font-semibold tracking-tight">
            {item.place} · {item.incidentCode}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {item.detail}
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-[12px] text-[var(--muted)]">{item.timeLabel}</p>
          <p className="mt-0.5 text-[12px] font-medium text-[var(--foreground)]">
            {item.metaLabel}
          </p>
          <Link
            href={item.ctaHref}
            className="mt-3 inline-flex rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
          >
            {item.ctaLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}

function SectionShell({
  title,
  count,
  description,
  defaultOpen = true,
  children,
}: {
  title: string;
  count: number;
  description: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm sm:px-5"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              {title}
            </h2>
            <span className="rounded-full bg-[var(--foreground)]/6 px-2 py-0.5 text-[11px] font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
              {count} {count === 1 ? "item" : "items"}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">{description}</p>
        </div>
        <span className="text-[var(--muted)] group-open:rotate-180">▾</span>
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

export function CommandActivity() {
  const { scopedReports } = useCommandWorkspace();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [commitments, setCommitments] = useState<AssistanceCommitment[]>([]);

  useEffect(() => {
    function refresh() {
      setCommitments(listAssistanceCommitments());
    }
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const board = useMemo(
    () => buildActivityBoard(scopedReports, commitments),
    [scopedReports, commitments],
  );

  const q = query.trim().toLowerCase();

  const followUps = useMemo(() => {
    if (!q) return board.followUps;
    return board.followUps.filter((item) => item.searchText.includes(q));
  }, [board.followUps, q]);

  const inProgress = useMemo(() => {
    if (!q) return board.inProgress;
    return board.inProgress.filter((item) => item.searchText.includes(q));
  }, [board.inProgress, q]);

  const completed = useMemo(() => {
    if (!q) return board.completed;
    return board.completed.filter((item) =>
      `${item.place} ${item.incidentCode} ${item.supplyLine}`
        .toLowerCase()
        .includes(q),
    );
  }, [board.completed, q]);

  const otherUpdates = useMemo(() => {
    if (!q) return board.otherUpdates;
    return board.otherUpdates.filter((item) =>
      `${item.place} ${item.incidentCode} ${item.detail}`
        .toLowerCase()
        .includes(q),
    );
  }, [board.otherUpdates, q]);

  const showFollowUp = filter === "all" || filter === "followup";
  const showInProgress = filter === "all" || filter === "in_progress";
  const showCompleted = filter === "all" || filter === "completed";
  const showOther = filter === "all" || filter === "other";

  const tabs: { id: ActivityFilter; label: string; count: number }[] = [
    { id: "all", label: "All activity", count: board.counts.all },
    { id: "in_progress", label: "In progress", count: board.counts.inProgress },
    { id: "followup", label: "Needs follow-up", count: board.counts.followUp },
    {
      id: "completed",
      label: "Completed",
      count: board.completed.length,
    },
    { id: "other", label: "Other updates", count: board.counts.other },
  ];

  const summary = [
    {
      value: board.counts.inProgress,
      label: "In progress",
      tone: "bg-[#eff6ff] text-[#2f5f9e]",
    },
    {
      value: board.counts.followUp,
      label: "Needs follow-up",
      tone: "bg-[#fff7f7] text-[#c72929]",
    },
    {
      value: board.counts.completedToday,
      label: "Completed today",
      tone: "bg-[#ecfdf3] text-[#16794c]",
    },
    {
      value: board.counts.other,
      label: "Other updates",
      tone: "bg-[#f5f3ff] text-[#6d28d9]",
    },
  ] as const;

  const empty =
    (!showFollowUp || followUps.length === 0) &&
    (!showInProgress || inProgress.length === 0) &&
    (!showCompleted || completed.length === 0) &&
    (!showOther || otherUpdates.length === 0);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <FadeIn y={8} className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
              Activity
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              Track ongoing assistance, follow-ups and completed actions.
            </p>
            <p className="mt-1 text-[12px] text-[var(--muted)]">
              {board.snapshotFull}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
            <span
              className="size-1.5 rounded-full bg-[#16794c]"
              aria-hidden
            />
            Updated {board.updatedClock}
          </span>
        </div>
      </FadeIn>

      <div className="mt-4 grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((card, i) => (
          <FadeIn key={card.label} delay={0.04 + i * 0.03} y={8}>
            <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3.5 shadow-sm">
              <p
                className={cn(
                  "inline-flex rounded-lg px-2 py-0.5 font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums tracking-wide",
                  card.tone,
                )}
              >
                {card.value}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">{card.label}</p>
            </div>
          </FadeIn>
        ))}
      </div>

      <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-medium transition ring-1",
                filter === tab.id
                  ? "bg-[#2f5f9e] text-white ring-[#2f5f9e]"
                  : "bg-white text-[var(--muted)] ring-[var(--border)] hover:text-[var(--foreground)]",
              )}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="activity-search">
          Search by barangay or incident
        </label>
        <input
          id="activity-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by barangay or incident #"
          className="w-full max-w-xs rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--foreground)] shadow-sm outline-none placeholder:text-[var(--muted)] focus:border-[#3b6fb6]/50"
        />
      </div>

      <div className="mt-4 space-y-4 pb-6">
        {empty ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white/70 px-5 py-12 text-center">
            <p className="font-medium text-[var(--foreground)]">
              No activity in this view
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Dispatched deliveries, partner follow-ups, completed assistance,
              and open approvals appear here from the live workspace.
            </p>
          </div>
        ) : null}

        {showFollowUp && followUps.length > 0 ? (
          <SectionShell
            title="Needs follow-up"
            count={followUps.length}
            description="Requests that need an update, confirmation or action."
          >
            {followUps.map((item) => (
              <FollowUpCard key={item.id} item={item} />
            ))}
          </SectionShell>
        ) : null}

        {showInProgress && inProgress.length > 0 ? (
          <SectionShell
            title="In progress"
            count={inProgress.length}
            description="Approved assistance that is being dispatched or delivered."
          >
            {inProgress.map((item) => (
              <InProgressCard key={item.id} item={item} />
            ))}
          </SectionShell>
        ) : null}

        {showCompleted && completed.length > 0 ? (
          <SectionShell
            title="Completed"
            count={completed.length}
            description="Delivered assistance with recorded evidence."
          >
            {completed.map((item) => (
              <CompletedCard key={item.id} item={item} />
            ))}
          </SectionShell>
        ) : null}

        {showOther && otherUpdates.length > 0 ? (
          <SectionShell
            title="Other updates"
            count={otherUpdates.length}
            description="Approvals, unassigned incidents and other important updates."
          >
            {otherUpdates.map((item) => (
              <OtherUpdateCard key={item.id} item={item} />
            ))}
          </SectionShell>
        ) : null}
      </div>

      <p className="pb-2 text-center text-[11px] text-[var(--muted)]">
        Conceptual exercise data · Not a live emergency feed.
      </p>
    </div>
  );
}
