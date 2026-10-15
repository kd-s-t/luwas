"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, FileText, Package } from "lucide-react";
import { FadeIn } from "@/components/motion/primitives";
import { OverviewMapPanel } from "@/components/OverviewMapPanel";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import {
  buildAttentionBoard,
  type AttentionItem,
  type AttentionKind,
} from "@/lib/workspace/attentionBoard";
import { cn } from "@/lib/utils";

function kindIcon(kind: AttentionKind) {
  if (kind === "critical") return AlertTriangle;
  if (kind === "resource") return Package;
  return FileText;
}

function kindAccent(kind: AttentionKind) {
  if (kind === "critical") {
    return {
      ring: "border-[#fecaca] bg-[#fff7f7]",
      icon: "text-[#c72929]",
      tagCritical: "bg-[#c72929]/10 text-[#c72929] ring-[#c72929]/20",
      tagWarn: "bg-[#f59e0b]/12 text-[#b45309] ring-[#f59e0b]/25",
      tagInfo: "bg-[#3b6fb6]/10 text-[#2f5f9e] ring-[#3b6fb6]/20",
    };
  }
  if (kind === "resource") {
    return {
      ring: "border-[#fde68a] bg-white",
      icon: "text-[#d97706]",
      tagCritical: "bg-[#c72929]/10 text-[#c72929] ring-[#c72929]/20",
      tagWarn: "bg-[#f59e0b]/12 text-[#b45309] ring-[#f59e0b]/25",
      tagInfo: "bg-[#3b6fb6]/10 text-[#2f5f9e] ring-[#3b6fb6]/20",
    };
  }
  return {
    ring: "border-[#bfdbfe] bg-white",
    icon: "text-[#3b6fb6]",
    tagCritical: "bg-[#c72929]/10 text-[#c72929] ring-[#c72929]/20",
    tagWarn: "bg-[#f59e0b]/12 text-[#b45309] ring-[#f59e0b]/25",
    tagInfo: "bg-[#3b6fb6]/10 text-[#2f5f9e] ring-[#3b6fb6]/20",
  };
}

function AttentionCard({ item, index }: { item: AttentionItem; index: number }) {
  const Icon = kindIcon(item.kind);
  const accent = kindAccent(item.kind);

  return (
    <FadeIn delay={0.05 + index * 0.05} y={10}>
      <article
        className={cn(
          "flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-stretch sm:gap-4 sm:p-5",
          accent.ring,
        )}
      >
        <div className="flex gap-3 sm:min-w-0 sm:flex-1">
          <div
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/80",
              accent.icon,
            )}
          >
            <Icon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] tracking-wide text-[var(--muted)]">
                {item.incidentCode}
              </span>
              {item.tags.map((tag) => (
                <span
                  key={tag.label}
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1",
                    tag.tone === "critical"
                      ? accent.tagCritical
                      : tag.tone === "warn"
                        ? accent.tagWarn
                        : accent.tagInfo,
                  )}
                >
                  {tag.label}
                </span>
              ))}
            </div>
            <h3 className="mt-1.5 text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-[17px]">
              {item.headline}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
              {item.detail}
            </p>
            <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">
              {item.timeLabel}
              <span className="mx-1.5 text-[var(--border)]">·</span>
              {item.meta}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center sm:pl-2">
          <Link
            href={item.ctaHref}
            className={cn(
              "inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-medium transition sm:w-auto",
              item.primaryCta
                ? "bg-[#c72929] text-white hover:bg-[#9e1a1a]"
                : "border border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--foreground)]/30",
            )}
          >
            {item.ctaLabel} →
          </Link>
        </div>
      </article>
    </FadeIn>
  );
}

export function CommandOverview() {
  const { profile } = useAuth();
  const { scopedReports, weatherOk, weatherHazard } = useCommandWorkspace();

  const board = useMemo(
    () => buildAttentionBoard(scopedReports),
    [scopedReports],
  );

  const orgHint = isOfficer(profile) ? profile.orgName : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <FadeIn y={8} className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
              What needs attention?
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Responder overview
              {orgHint ? ` · ${orgHint}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                weatherOk === false || weatherHazard
                  ? "bg-[#fff7ed] text-[#c2410c] ring-[#fdba74]/70"
                  : "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60",
              )}
            >
              <AlertTriangle className="size-3.5" aria-hidden />
              {weatherOk === false
                ? "Weather bulletin unverified"
                : weatherHazard
                  ? "Weather watch active"
                  : "Weather bulletin clear"}
            </span>
          </div>
        </div>
      </FadeIn>

      <div className="mt-4 grid shrink-0 gap-3 sm:grid-cols-3">
        {(
          [
            {
              label: "Urgent incidents",
              value: board.urgent,
              icon: AlertTriangle,
              iconClass: "text-[#c72929]",
            },
            {
              label: "Resource shortages",
              value: board.shortages,
              icon: Package,
              iconClass: "text-[#3b6fb6]",
            },
            {
              label: "Pending approvals",
              value: board.approvals,
              icon: FileText,
              iconClass: "text-[#7c3aed]",
            },
          ] as const
        ).map((card, i) => (
          <FadeIn key={card.label} delay={0.04 + i * 0.04} y={8}>
            <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-4 py-3.5 shadow-sm">
              <div>
                <p className="text-sm text-[var(--muted)]">{card.label}</p>
                <p className="mt-0.5 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-wide">
                  {card.value}
                </p>
              </div>
              <card.icon
                className={cn("size-6 opacity-90", card.iconClass)}
                aria-hidden
              />
            </div>
          </FadeIn>
        ))}
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
              Needs your attention
            </h2>
            <Link
              href="/admin/incidents"
              className="text-sm font-medium text-[#2f5f9e] hover:underline"
            >
              Open board →
            </Link>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
            {board.items.length === 0 ? (
              <div className="flex h-full min-h-[12rem] flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-white/70 px-5 py-10 text-center">
                <p className="font-medium text-[var(--foreground)]">
                  No urgent actions in scope
                </p>
                <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">
                  When field reports need review, supply confirmation, or plan
                  approval, they appear here.
                </p>
              </div>
            ) : (
              board.items.map((item, index) => (
                <AttentionCard key={item.id} item={item} index={index} />
              ))
            )}
          </div>
          <p className="mt-3 shrink-0 text-[11px] text-[var(--muted)]">
            Conceptual exercise data · Not a live emergency feed.
          </p>
        </section>

        <div className="flex min-h-[280px] flex-1 flex-col lg:min-h-0">
          <OverviewMapPanel items={board.items} fill />
        </div>
      </div>
    </div>
  );
}
