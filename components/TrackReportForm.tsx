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
import { getHazardReportById } from "@/lib/reports/api";
import {
  listGuestReportIds,
  saveGuestReportId,
} from "@/lib/reports/guestReportStore";
import {
  hazardHintLabel,
  type HazardReport,
} from "@/lib/reports/types";
import { cn } from "@/lib/utils";

const LUW_RE = /^LUW-\d{6}-\d{4}$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeRef(raw: string): string {
  return raw.trim();
}

function isValidRef(ref: string): boolean {
  return LUW_RE.test(ref) || UUID_RE.test(ref);
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

/** 0=received done, current step index 1..4 (review..completed) */
function currentStepIndex(report: HazardReport): number {
  if (report.investigatedAt) return 3;
  if (report.investigatorUid || report.dispatchLog || report.autoResponderCallAt) {
    return 2;
  }
  return 1;
}

type ProgressStep = {
  key: string;
  title: string;
  detail: string;
  state: "done" | "current" | "todo";
};

function buildProgress(
  report: HazardReport,
  language: CitizenLang,
): ProgressStep[] {
  const cur = currentStepIndex(report);
  const receivedAt = formatWhen(report.createdAt, language, true);
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
            ? t(language, "track.stepCurrentAssigned")
            : t(language, "track.stepNotYetAssigned"),
    },
    {
      key: "progress",
      title: t(language, "track.stepProgress"),
      detail:
        cur === 3
          ? t(language, "track.stepCurrentProgress")
          : t(language, "track.stepNotYetStarted"),
    },
    {
      key: "completed",
      title: t(language, "track.stepCompleted"),
      detail: t(language, "track.stepNotYetCompleted"),
    },
  ];
  return rows.map((row, i) => {
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
  const cur = currentStepIndex(report);

  if (cur >= 2) {
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
  const cur = currentStepIndex(report);
  if (cur >= 3) {
    return {
      title: t(language, "track.statusProgressTitle"),
      body: t(language, "track.statusProgressBody"),
    };
  }
  if (cur >= 2) {
    return {
      title: t(language, "track.statusAssignedTitle"),
      body: t(language, "track.statusAssignedBody"),
    };
  }
  return {
    title: t(language, "track.statusReviewTitle"),
    body: t(language, "track.statusReviewBody"),
  };
}

export function TrackReportForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [language, setLanguage] = useState<CitizenLang>("en");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [report, setReport] = useState<HazardReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    setSaved(listGuestReportIds());
  }, []);

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
          setReport(null);
          setError(t(language, "track.notFound", { ref: id }));
          return;
        }
        saveGuestReportId(id);
        setSaved(listGuestReportIds());
        setReport(row);
        setValue(id);
        setLastChecked(new Date());
      } catch {
        setReport(null);
        setError(t(language, "track.notFound", { ref: id }));
      } finally {
        setLoading(false);
      }
    },
    [language],
  );

  useEffect(() => {
    const q = searchParams.get("ref")?.trim();
    if (q) {
      setValue(q.toUpperCase().startsWith("LUW") ? q.toUpperCase() : q);
      void load(q);
      return;
    }
    const ids = listGuestReportIds();
    if (ids[0]) {
      setValue(ids[0]);
      void load(ids[0]);
    }
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
    <div className="space-y-5">
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
              setValue(
                next.toUpperCase().startsWith("LUW")
                  ? next.toUpperCase()
                  : next,
              );
              setError(null);
            }}
            placeholder={t(language, "track.placeholder")}
            autoComplete="off"
            spellCheck={false}
            className={cn(
              "w-full rounded-xl border bg-[var(--surface)] px-3 py-3 font-mono text-sm outline-none",
              error
                ? "border-[var(--danger)]"
                : "border-[var(--border)] focus:border-[#2563eb]/40",
            )}
          />
        </label>
        {error ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
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

      {!report && saved.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
            {t(language, "track.onDevice")}
          </p>
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {saved.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="flex w-full min-w-0 items-center justify-between gap-3 px-3.5 py-3 text-left transition hover:bg-[var(--surface-raised)]"
                  onClick={() => void load(id)}
                >
                  <span className="truncate font-mono text-sm font-semibold">
                    {id}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-[#2563eb]">
                    {t(language, "track.open")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report && banner ? (
        <>
          <div className="flex gap-2.5 rounded-xl border border-[#f0d9a8] bg-[#fff8e8] px-3.5 py-3.5">
            <span
              className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#8a6a2f] text-[11px] font-bold text-white"
              aria-hidden
            >
              !
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-semibold text-[#5c4a1f]">
                {banner.title}
              </p>
              <p className="text-xs leading-relaxed text-[#5c4a1f]/90">
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
                        step.state === "todo" &&
                          "border-[var(--border)] bg-[var(--surface)]",
                      )}
                      aria-hidden
                    >
                      {step.state === "done" ? (
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
