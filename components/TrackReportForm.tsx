"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import {
  CitizenFooter,
  CitizenHeader,
  Danger911Banner,
} from "@/components/citizen/CitizenChrome";
import { t, type CitizenLang } from "@/lib/citizen/i18n";
import { useCitizenLanguage } from "@/lib/citizen/languagePreference";
import { getHazardReportById } from "@/lib/reports/api";
import {
  hasGuestReportId,
  listGuestReportIds,
  removeGuestReportId,
  saveGuestReportId,
} from "@/lib/reports/guestReportStore";
import {
  hazardHintLabel,
  type HazardReport,
} from "@/lib/reports/types";
import { cn } from "@/lib/utils";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeRef(raw: string): string {
  return raw.trim();
}

function isValidRef(ref: string): boolean {
  const upper = ref.toUpperCase();
  return (
    /^LUW-\d{6}-\d{4}$/.test(upper) ||
    /^[A-Z]{2,4}-[A-Z0-9]{2,8}-[A-Z0-9]{2,10}-\d{6}-\d{4}$/.test(upper) ||
    UUID_RE.test(ref)
  );
}

function formatWhen(iso: string, language: CitizenLang, short = false): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const locale =
    language === "fil" ? "fil-PH" : language === "ceb" ? "en-PH" : "en-PH";
  if (short) {
    return d.toLocaleString(locale, {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  const date = d.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${date} · ${time}`;
}

function floodLabel(hint: HazardReport["hazardHint"]): string {
  if (hint === "flood") return "Flooding";
  return hazardHintLabel(hint);
}

function intentLabel(report: HazardReport, language: CitizenLang): string {
  if (report.draftIntent === "reportHazard") {
    return t(language, "intent.reportHazard");
  }
  return t(language, "intent.needHelp");
}

function isClosedRejected(report: HazardReport): boolean {
  return report.status === "rejected" || report.status === "failed";
}

/**
 * Current step index in the citizen progress rail:
 * 0 received · 1 under review · 2 assigned · 3 in progress · 4 completed
 */
function currentStepIndex(report: HazardReport): number {
  if (isClosedRejected(report)) return 1;
  if (report.status === "done") return 4;
  if (
    report.status === "dispatched" ||
    report.dispatchLog ||
    report.autoResponderCallAt ||
    report.manualDispatchChecked
  ) {
    return 3;
  }
  if (
    report.status === "assigned" ||
    report.investigatorUid ||
    report.investigatedAt ||
    (report.assignees && report.assignees.length > 0)
  ) {
    return 2;
  }
  return 1;
}

type ProgressStep = {
  key: string;
  title: string;
  detail: string;
  state: "done" | "current" | "todo" | "rejected";
};

function buildProgress(
  report: HazardReport,
  language: CitizenLang,
): ProgressStep[] {
  const receivedAt = formatWhen(report.createdAt, language, true);
  const reviewedAt = formatWhen(
    report.validatedAt || report.updatedAt || report.createdAt,
    language,
    true,
  );

  if (isClosedRejected(report)) {
    return [
      {
        key: "received",
        title: t(language, "track.stepReceived"),
        detail: receivedAt,
        state: "done",
      },
      {
        key: "review",
        title: t(language, "track.stepReview"),
        detail: reviewedAt,
        state: "done",
      },
      {
        key: "rejected",
        title: t(language, "track.stepRejected"),
        detail: t(language, "track.stepRejectedDetail"),
        state: "rejected",
      },
    ];
  }

  const cur = currentStepIndex(report);
  const rows: Omit<ProgressStep, "state">[] = [
    {
      key: "received",
      title: t(language, "track.stepReceived"),
      detail: receivedAt,
    },
    {
      key: "review",
      title: t(language, "track.stepReview"),
      detail:
        cur === 1
          ? t(language, "track.stepCurrentPending")
          : formatWhen(report.updatedAt || report.createdAt, language, true),
    },
    {
      key: "assigned",
      title: t(language, "track.stepAssigned"),
      detail:
        cur === 2
          ? t(language, "track.stepCurrentAssigned")
          : cur > 2
            ? t(language, "track.stepAssignedDone")
            : t(language, "track.stepNotYetAssigned"),
    },
    {
      key: "progress",
      title: t(language, "track.stepProgress"),
      detail:
        cur === 3
          ? t(language, "track.stepCurrentProgress")
          : cur > 3
            ? t(language, "track.stepProgressDone")
            : t(language, "track.stepNotYetStarted"),
    },
    {
      key: "completed",
      title: t(language, "track.stepCompleted"),
      detail:
        cur >= 4
          ? formatWhen(report.updatedAt || report.createdAt, language, true)
          : t(language, "track.stepNotYetCompleted"),
    },
  ];
  return rows.map((row, i) => {
    if (cur >= 4) {
      return { ...row, state: "done" as const };
    }
    if (i < cur) return { ...row, state: "done" as const };
    if (i === cur) return { ...row, state: "current" as const };
    return { ...row, state: "todo" as const };
  });
}

type UpdateItem = { at: string; title: string; body: string };

function buildUpdates(
  report: HazardReport,
  language: CitizenLang,
): UpdateItem[] {
  const items: UpdateItem[] = [];

  if (isClosedRejected(report)) {
    items.push({
      at: report.validatedAt || report.updatedAt || report.createdAt,
      title: t(language, "track.updateRejectedTitle"),
      body:
        report.aiReason?.trim() ||
        t(language, "track.updateRejectedBody"),
    });
  } else {
    const cur = currentStepIndex(report);
    if (cur >= 4) {
      items.push({
        at: report.updatedAt || report.createdAt,
        title: t(language, "track.updateCompletedTitle"),
        body: t(language, "track.updateCompletedBody"),
      });
    } else if (cur >= 3) {
      items.push({
        at: report.updatedAt || report.createdAt,
        title: t(language, "track.updateProgressTitle"),
        body: t(language, "track.updateProgressBody"),
      });
    } else if (cur >= 2) {
      items.push({
        at: report.updatedAt || report.createdAt,
        title: t(language, "track.updateAssignedTitle"),
        body: t(language, "track.updateAssignedBody"),
      });
    } else {
      items.push({
        at: report.updatedAt || report.createdAt,
        title: t(language, "track.updateWaitingTitle"),
        body: t(language, "track.updateWaitingBody"),
      });
    }
  }

  items.push({
    at: report.updatedAt || report.createdAt,
    title: t(language, "track.updateReviewTitle"),
    body: t(language, "track.updateReviewBody"),
  });

  items.push({
    at: report.createdAt,
    title: t(language, "track.updateReceivedTitle"),
    body: t(language, "track.updateReceivedBody"),
  });

  return items;
}

function statusBanner(report: HazardReport, language: CitizenLang) {
  if (isClosedRejected(report)) {
    return {
      title: t(language, "track.statusRejectedTitle"),
      body:
        report.aiReason?.trim() ||
        t(language, "track.statusRejectedBody"),
      tone: "danger" as const,
    };
  }
  const cur = currentStepIndex(report);
  if (cur >= 4) {
    return {
      title: t(language, "track.statusCompletedTitle"),
      body: t(language, "track.statusCompletedBody"),
      tone: "ok" as const,
    };
  }
  if (cur >= 3) {
    return {
      title: t(language, "track.statusProgressTitle"),
      body: t(language, "track.statusProgressBody"),
      tone: "warn" as const,
    };
  }
  if (cur >= 2) {
    return {
      title: t(language, "track.statusAssignedTitle"),
      body: t(language, "track.statusAssignedBody"),
      tone: "warn" as const,
    };
  }
  return {
    title: t(language, "track.statusReviewTitle"),
    body: t(language, "track.statusReviewBody"),
    tone: "warn" as const,
  };
}

export function TrackReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useCitizenLanguage();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [report, setReport] = useState<HazardReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const load = useCallback(
    async (raw: string) => {
      const id = normalizeRef(raw);
      if (!id) {
        setError(t(language, "track.enterRef"));
        return;
      }
      if (!isValidRef(id)) {
        setError(t(language, "track.badFormat"));
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const row = await getHazardReportById(id);
        if (!row || row.status === "draft") {
          // Drafts / wiped emulator docs linger in localStorage — drop them.
          if (hasGuestReportId(id)) {
            removeGuestReportId(id);
            setSaved(listGuestReportIds());
          }
          setReport(null);
          setError(t(language, "track.notFound", { ref: id }));
          return;
        }
        saveGuestReportId(id);
        setSaved(listGuestReportIds());
        setReport(row);
        setValue(id);
        setLastChecked(new Date());
        const href = `/track-report?ref=${encodeURIComponent(id)}`;
        if (searchParams.get("ref") !== id) {
          router.replace(href, { scroll: false });
        }
      } catch {
        if (hasGuestReportId(id)) {
          removeGuestReportId(id);
          setSaved(listGuestReportIds());
        }
        setReport(null);
        setError(t(language, "track.notFound", { ref: id }));
      } finally {
        setLoading(false);
      }
    },
    [language, router, searchParams],
  );

  /** Prune stale device refs first, then open ?ref= or the newest surviving id. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ids = listGuestReportIds();
      await Promise.all(
        ids.map(async (id) => {
          try {
            const row = await getHazardReportById(id);
            if (!row || row.status === "draft") removeGuestReportId(id);
          } catch {
            removeGuestReportId(id);
          }
        }),
      );
      if (cancelled) return;
      const next = listGuestReportIds();
      setSaved(next);

      const q = searchParams.get("ref")?.trim();
      if (q) {
        setValue(isValidRef(q) && !UUID_RE.test(q) ? q.toUpperCase() : q);
        void load(q);
        return;
      }
      if (next[0]) {
        setValue(next[0]);
        void load(next[0]);
      } else {
        setValue("");
        setError(null);
        setReport(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial hydrate only
  }, []);
  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void load(value);
  }

  const progress = useMemo(
    () => (report ? buildProgress(report, language) : []),
    [report, language],
  );
  const updates = useMemo(
    () => (report ? buildUpdates(report, language) : []),
    [report, language],
  );
  const banner = report ? statusBanner(report, language) : null;

  const placeLine = report
    ? [
        report.barangay ? `Brgy. ${report.barangay}` : null,
        report.lgu || null,
      ]
        .filter(Boolean)
        .join(", ") ||
      report.locationLabel ||
      report.citizenPurok
    : "";

  const landmarkLine = report
    ? [
        report.locationLabel && report.barangay ? report.locationLabel : null,
        t(language, "track.approxLocation"),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-5">
      <CitizenHeader
        language={language}
        onLanguageChange={setLanguage}
        variant="brand"
      />

      <div className="space-y-1.5 pt-2">
        <h1 className="text-[28px] leading-[1.15] font-bold tracking-tight text-[var(--foreground)]">
          {t(language, "track.title")}
        </h1>
        <p className="text-[15px] leading-relaxed text-[var(--muted)]">
          {t(language, "track.subtitle")}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            {t(language, "track.reference")}
          </span>
          <input
            value={value}
            onChange={(e) => {
              const next = e.target.value.trimStart();
              const upper = next.toUpperCase();
              setValue(
                upper.startsWith("LUW") || upper.startsWith("CEB-")
                  ? upper
                  : next,
              );
              setError(null);
            }}
            placeholder={t(language, "track.placeholder")}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={!!error}
            aria-describedby={error ? "track-error" : undefined}
            className={cn(
              "w-full rounded-xl border bg-[var(--surface)] px-3 py-3 font-mono text-sm outline-none",
              error
                ? "border-[var(--danger)]"
                : "border-[var(--border)] focus:border-[#2563eb]/40",
            )}
          />
        </label>
        {error ? (
          <p
            id="track-error"
            className="text-sm text-[var(--danger)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--foreground)]/25 bg-[var(--surface)] px-4 py-[14px] text-[15px] font-semibold text-[var(--foreground)] disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          {loading
            ? t(language, "track.checking")
            : t(language, "track.checkUpdates")}
        </button>
        {lastChecked ? (
          <p className="text-center text-xs text-[var(--muted)]">
            {t(language, "track.lastChecked", {
              when: formatWhen(lastChecked.toISOString(), language),
            })}
          </p>
        ) : null}
      </form>

      {saved.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
            {t(language, "track.onDevice")}
          </p>
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {saved.map((id) => {
              const active = report?.id === id || value.trim() === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full min-w-0 items-center justify-between gap-3 px-3.5 py-3 text-left transition hover:bg-[var(--surface-raised)]",
                      active && "bg-[#eff6ff]",
                    )}
                    onClick={() => void load(id)}
                  >
                    <span className="truncate font-mono text-sm font-semibold">
                      {id}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-semibold",
                        active ? "text-[#1d4ed8]" : "text-[#2563eb]",
                      )}
                    >
                      {active
                        ? t(language, "track.current")
                        : t(language, "track.open")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {report && banner ? (
        <>
          <div
            className={cn(
              "flex gap-2.5 rounded-xl border px-3.5 py-3.5",
              banner.tone === "danger"
                ? "border-[var(--danger)]/35 bg-[var(--danger)]/8"
                : banner.tone === "ok"
                  ? "border-[#86efac]/60 bg-[#ecfdf3]"
                  : "border-[#f0d9a8] bg-[#fff8e8]",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
                banner.tone === "danger"
                  ? "bg-[var(--danger)]"
                  : banner.tone === "ok"
                    ? "bg-[#16794c]"
                    : "bg-[#8a6a2f]",
              )}
              aria-hidden
            >
              {banner.tone === "ok" ? "✓" : "!"}
            </span>
            <div className="min-w-0 space-y-0.5">
              <p
                className={cn(
                  "text-sm font-semibold",
                  banner.tone === "danger"
                    ? "text-[var(--danger)]"
                    : banner.tone === "ok"
                      ? "text-[#16794c]"
                      : "text-[#5c4a1f]",
                )}
              >
                {banner.title}
              </p>
              <p
                className={cn(
                  "text-xs leading-relaxed",
                  banner.tone === "danger"
                    ? "text-[var(--danger)]/90"
                    : banner.tone === "ok"
                      ? "text-[#16794c]/90"
                      : "text-[#5c4a1f]/90",
                )}
              >
                {banner.body}
              </p>
            </div>
          </div>

          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t(language, "track.progress")}
            </p>
            <ol className="relative mt-4 space-y-0">
              {progress.map((step, i) => {
                const next = progress[i + 1];
                const lineAfter =
                  next == null
                    ? null
                    : step.state === "done"
                      ? "bg-[#2563eb]"
                      : "bg-[var(--border)]";
                return (
                  <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
                    {lineAfter ? (
                      <span
                        className={cn(
                          "absolute top-5 left-[9px] h-[calc(100%-8px)] w-0.5",
                          lineAfter,
                        )}
                        aria-hidden
                      />
                    ) : null}
                    <span
                      className={cn(
                        "relative z-[1] mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                        step.state === "done" &&
                          "border-[var(--success)] bg-[var(--success)] text-white",
                        step.state === "current" &&
                          "border-[#2563eb] bg-[var(--surface)]",
                        step.state === "rejected" &&
                          "border-[var(--danger)] bg-[var(--danger)] text-white",
                        step.state === "todo" &&
                          "border-[var(--border)] bg-[var(--surface)]",
                      )}
                      aria-hidden
                    >
                      {step.state === "done" || step.state === "rejected" ? (
                        <Check className="size-3" strokeWidth={3} />
                      ) : step.state === "current" ? (
                        <span className="size-2 rounded-full bg-[#2563eb]" />
                      ) : null}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          step.state === "done" && "text-[var(--success)]",
                          step.state === "current" && "text-[#2563eb]",
                          step.state === "rejected" && "text-[var(--danger)]",
                          step.state === "todo" && "text-[var(--muted)]",
                        )}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-[var(--muted)]">{step.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t(language, "track.latest")}
            </p>
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {updates.map((u) => (
                <li key={`${u.title}-${u.at}`} className="space-y-1 py-3 first:pt-0 last:pb-0">
                  <p className="text-xs font-semibold text-[#2563eb]">
                    {formatWhen(u.at, language)}
                  </p>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {u.title}
                  </p>
                  <p className="text-sm leading-relaxed text-[var(--muted)]">
                    {u.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {hasGuestReportId(report.id) ? (
            <div className="space-y-2">
              <button
                type="button"
                className="flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-[14px] text-[15px] font-semibold text-[var(--foreground)]"
                onClick={() =>
                  router.push(
                    `/report-incident/${encodeURIComponent(report.id)}`,
                  )
                }
              >
                {t(language, "track.updateReport")}
              </button>
              <p className="text-center text-xs leading-relaxed text-[var(--muted)]">
                {t(language, "track.updateHint")}
              </p>
            </div>
          ) : null}

          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {t(language, "track.yourReport")}
            </p>
            <p className="mt-2.5 text-sm font-semibold text-[var(--foreground)]">
              {intentLabel(report, language)}
              {" · "}
              {floodLabel(report.hazardHint)}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-[var(--foreground)]">
              {report.notes || report.title}
            </p>
            {placeLine ? (
              <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                {placeLine}
              </p>
            ) : null}
            {landmarkLine ? (
              <p className="mt-0.5 text-sm text-[var(--muted)]">{landmarkLine}</p>
            ) : null}
            {report.mediaUrl ? (
              <div className="mt-3 flex min-w-0 items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={report.mediaUrl}
                  alt=""
                  className="size-12 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {report.mediaPath?.split("/").pop() || "photo.jpg"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {t(language, "track.photoMeta", { count: "1" })}
                  </p>
                </div>
              </div>
            ) : null}
            {hasGuestReportId(report.id) ? (
              <button
                type="button"
                className="mt-3 text-sm font-semibold text-[#2563eb]"
                onClick={() =>
                  router.push(
                    `/report-incident/${encodeURIComponent(report.id)}`,
                  )
                }
              >
                {t(language, "track.addCorrect")}
              </button>
            ) : null}
          </div>

          <Danger911Banner language={language} variant="soft" />

          <CitizenFooter language={language} tight />
        </>
      ) : (
        <CitizenFooter language={language} tight />
      )}
    </div>
  );
}
