"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, Cloud, FileText, Package, Users } from "lucide-react";
import { FadeIn } from "@/components/motion/primitives";
import { SituationMap } from "@/components/SituationMap";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  buildAttentionBoard,
  deskStockForReports,
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
      iconWrap: "bg-[#c72929]/10 text-[#c72929]",
      tagCritical: "bg-[#c72929]/10 text-[#c72929] ring-[#c72929]/20",
      tagWarn: "bg-[#f59e0b]/12 text-[#b45309] ring-[#f59e0b]/25",
      tagInfo: "bg-[#3b6fb6]/10 text-[#2f5f9e] ring-[#3b6fb6]/20",
    };
  }
  if (kind === "resource") {
    return {
      ring: "border-[#fde68a] bg-[#fffbeb]",
      iconWrap: "bg-[#f59e0b]/12 text-[#d97706]",
      tagCritical: "bg-[#c72929]/10 text-[#c72929] ring-[#c72929]/20",
      tagWarn: "bg-[#f59e0b]/12 text-[#b45309] ring-[#f59e0b]/25",
      tagInfo: "bg-[#3b6fb6]/10 text-[#2f5f9e] ring-[#3b6fb6]/20",
    };
  }
  return {
    ring: "border-[#bfdbfe] bg-[#f8fbff]",
    iconWrap: "bg-[#3b6fb6]/10 text-[#3b6fb6]",
    tagCritical: "bg-[#c72929]/10 text-[#c72929] ring-[#c72929]/20",
    tagWarn: "bg-[#f59e0b]/12 text-[#b45309] ring-[#f59e0b]/25",
    tagInfo: "bg-[#3b6fb6]/10 text-[#2f5f9e] ring-[#3b6fb6]/20",
  };
}

function formatSnapshot(date: Date): { full: string; clock: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  }).formatToParts(date);

  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const dayPeriod = (
    parts.find((p) => p.type === "dayPeriod")?.value ?? ""
  ).toUpperCase();

  return {
    full: `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod} (PHT)`,
    clock: `${hour}:${minute} ${dayPeriod}`,
  };
}

function AttentionCard({ item, index }: { item: AttentionItem; index: number }) {
  const Icon = kindIcon(item.kind);
  const accent = kindAccent(item.kind);
  const sharedShortage = item.tags.some(
    (t) => t.label === "Shared resource shortage",
  );

  return (
    <FadeIn delay={0.05 + index * 0.05} y={10}>
      <article
        className={cn(
          "rounded-2xl border p-4 shadow-sm sm:p-5",
          accent.ring,
          sharedShortage ? "bg-[#fffbeb]" : "bg-white",
        )}
      >
        <div className="flex gap-3">
          <div
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
              accent.iconWrap,
            )}
          >
            <Icon className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
                <span className="font-mono text-[11px] tracking-wide text-[var(--muted)]">
                  {item.incidentCode}
                </span>
              </div>
              {sharedShortage ? (
                <div className="shrink-0 text-right text-[11px] leading-relaxed text-[var(--muted)]">
                  <p>{item.timeLabel}</p>
                  <p>{item.meta}</p>
                </div>
              ) : null}
            </div>
            <h3 className="mt-2 text-base font-semibold tracking-tight text-[var(--foreground)] sm:text-[17px]">
              {item.headline}
            </h3>
            <p className="mt-1 text-sm leading-snug text-[var(--muted)]">
              {item.detail}
            </p>
            {item.affectsLabel ? (
              <p className="mt-1 text-sm leading-snug text-[var(--muted)]">
                {item.affectsLabel}
              </p>
            ) : null}
            {!sharedShortage ? (
              <p className="mt-2 text-[11px] text-[var(--muted)]">
                {item.timeLabel}
                <span className="mx-1.5 text-[var(--border)]">·</span>
                {item.meta}
              </p>
            ) : null}
            <div className="mt-3 flex justify-end">
              <Link
                href={item.ctaHref}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition",
                  item.primaryCta
                    ? "bg-[#c72929] text-white hover:bg-[#9e1a1a]"
                    : "border border-[#93c5fd] bg-white text-[#2f5f9e] hover:border-[#3b6fb6] hover:bg-[#f8fbff]",
                )}
              >
                {item.ctaLabel}
              </Link>
            </div>
          </div>
        </div>
      </article>
    </FadeIn>
  );
}

export function CommandOverview() {
  const { user } = useAuth();
  const { scopedReports, weatherOk, weatherHazard, seedReady } =
    useCommandWorkspace();

  const board = useMemo(
    () => buildAttentionBoard(scopedReports, deskStockForReports(scopedReports)),
    [scopedReports],
  );

  const snapshot = useMemo(() => formatSnapshot(new Date()), []);

  const shortageHref = useMemo(() => {
    const epics = board.items.filter(
      (item) =>
        item.kind === "resource" &&
        /^RS-\d+/i.test(item.incidentCode) &&
        (/\/admin\/resources\/RS-/i.test(item.ctaHref) ||
          item.ctaHref.includes("rs=")),
    );
    // Prefer drinking-water (RS-001) when present — Apas multi-sitio desk.
    const water = epics.find((item) =>
      /^RS-001$/i.test(item.incidentCode),
    );
    const epic = water ?? epics[0];
    return epic?.ctaHref ?? "/admin/resources";
  }, [board.items]);

  const weatherLabel =
    weatherOk === false
      ? "Weather bulletin unverified"
      : weatherHazard
        ? "Weather watch active"
        : "Weather bulletin clear";

  const weatherWarn = weatherOk === false || weatherHazard;

  const summaryCards = [
    {
      label: "Urgent incidents",
      value: board.urgent,
      href: "/admin/incidents",
      Icon: AlertTriangle,
      iconClass: "bg-[#c72929]/10 text-[#c72929]",
    },
    {
      label: "Resource shortages",
      value: board.shortages,
      href: shortageHref,
      Icon: Package,
      iconClass: "bg-[#f59e0b]/12 text-[#d97706]",
    },
    {
      label: "Pending approvals",
      value: board.approvals,
      href: "/admin/incidents",
      Icon: FileText,
      iconClass: "bg-[#3b6fb6]/10 text-[#3b6fb6]",
    },
    {
      label: "Communities affected",
      value: board.communities,
      href: "/admin/incidents",
      Icon: Users,
      iconClass: "bg-[#ecfdf3] text-[#16794c]",
    },
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <FadeIn y={8} className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
              What needs attention?
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Responder overview · Snapshot {snapshot.full}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                seedReady
                  ? "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60"
                  : "bg-[#f1f5f9] text-[var(--muted)] ring-[var(--border)]",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  seedReady ? "bg-[#16794c]" : "bg-[var(--muted)]",
                )}
                aria-hidden
              />
              {seedReady ? "Snapshot loaded" : "Loading snapshot"}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1",
                weatherWarn
                  ? "bg-[#fff7ed] text-[#c2410c] ring-[#fdba74]/70"
                  : "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60",
              )}
            >
              <Cloud className="size-3.5" aria-hidden />
              {weatherLabel}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
              Updated {snapshot.clock}
            </span>
          </div>
        </div>
      </FadeIn>

      <div className="mt-4 grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card, i) => (
          <FadeIn key={card.label} delay={0.04 + i * 0.04} y={8}>
            <Link
              href={card.href}
              className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 py-3.5 shadow-sm transition hover:border-[var(--foreground)]/20 hover:shadow-md"
            >
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  card.iconClass,
                )}
              >
                <card.Icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--muted)]">{card.label}</p>
                <p className="mt-0.5 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-wide">
                  {card.value}
                </p>
              </div>
              <span
                className="text-lg text-[var(--muted)]/50"
                aria-hidden
              >
                ›
              </span>
            </Link>
          </FadeIn>
        ))}
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden">
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
                Needs your attention
              </h2>
              <span className="rounded-full bg-[var(--foreground)]/6 px-2 py-0.5 text-[11px] font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
                {board.items.length}{" "}
                {board.items.length === 1 ? "item" : "items"}
              </span>
            </div>
            <Link
              href="/admin/incidents"
              className="text-sm font-medium text-[#2f5f9e] hover:underline"
            >
              View all incidents →
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
          <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
            <Link
              href="/admin/activity"
              className="text-sm font-medium text-[#2f5f9e] hover:underline"
            >
              Citizen report & source verification details →
            </Link>
            <p className="text-[11px] text-[var(--muted)]">
              Conceptual exercise data · Not a live emergency feed.
            </p>
          </div>
        </section>

        <div className="flex min-h-[280px] flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] lg:min-h-0">
          {user ? (
            <SituationMap
              officerUid={user.uid}
              fillRemaining
              hideChat
              hideAreaPanel
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
