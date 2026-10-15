"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  CitizenFooter,
  CitizenHeader,
  Danger911Banner,
} from "@/components/citizen/CitizenChrome";
import {
  easeOut,
  FadeIn,
  useMotionSafe,
} from "@/components/motion/primitives";
import { t, type CitizenLang } from "@/lib/citizen/i18n";
import { saveGuestReportId } from "@/lib/reports/guestReportStore";
import { cn } from "@/lib/utils";

type ReportReceivedProps = {
  referenceId: string;
  /** Guest → /reports/[id]; signed-in → /my-reports */
  guest?: boolean;
};

function formatReceivedWhen(d: Date, language: CitizenLang): string {
  const locale =
    language === "fil" ? "fil-PH" : language === "ceb" ? "en-PH" : "en-PH";
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

export function ReportReceived({
  referenceId,
  guest = true,
}: ReportReceivedProps) {
  const router = useRouter();
  const motionSafe = useMotionSafe();
  const [language, setLanguage] = useState<CitizenLang>("en");
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    saveGuestReportId(referenceId);
  }, [referenceId]);

  const shortRef = referenceId.startsWith("LUW-");
  const receivedAt = useMemo(
    () => formatReceivedWhen(now, language),
    [now, language],
  );

  const trackHref = guest
    ? `/track-report?ref=${encodeURIComponent(referenceId)}`
    : "/my-reports";

  function goTrack() {
    router.push(trackHref);
  }

  async function copyRef() {
    try {
      await navigator.clipboard?.writeText(referenceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function copyTrackLink() {
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      await navigator.clipboard?.writeText(`${origin}${trackHref}`);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <motion.div
      className="space-y-5"
      initial={motionSafe ? { opacity: 0, y: 18 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut }}
    >
      <CitizenHeader
        language={language}
        onLanguageChange={setLanguage}
        variant="brand"
      />

      <div className="space-y-1.5 pt-2">
        <h2 className="text-[28px] leading-[1.15] font-bold tracking-tight text-[var(--foreground)]">
          {t(language, "confirm.title")}
        </h2>
        <p className="text-[15px] leading-relaxed text-[var(--muted)]">
          {t(language, "confirm.body")}
        </p>
      </div>

      <FadeIn delay={0.12} y={12}>
        <div className="rounded-[14px] bg-[#eff6ff] px-4 py-4">
          <p className="text-sm text-[var(--muted)]">
            {t(language, "confirm.reference")}
          </p>
          <p
            className={cn(
              "mt-1.5 break-all font-bold tracking-tight text-[var(--foreground)]",
              shortRef
                ? "text-[26px] leading-tight"
                : "text-[15px] leading-snug sm:text-lg",
            )}
            title={referenceId}
          >
            {referenceId}
          </p>
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            {t(language, "confirm.receivedAt", { when: receivedAt })}
          </p>
          <button
            type="button"
            className="mt-3.5 flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 text-sm font-semibold text-[var(--foreground)]"
            onClick={() => void copyRef()}
          >
            {copied
              ? t(language, "common.copied")
              : t(language, "confirm.copy")}
          </button>
        </div>
      </FadeIn>

      <FadeIn delay={0.2} y={10}>
        <div className="flex gap-2.5 rounded-xl border border-[#f0d9a8] bg-[#fff8e8] px-3.5 py-3.5">
          <span
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-[#8a6a2f] text-[11px] font-bold text-white"
            aria-hidden
          >
            !
          </span>
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-[#5c4a1f]">
              {t(language, "confirm.noResponderTitle")}
            </p>
            <p className="text-xs leading-relaxed text-[#5c4a1f]/90">
              {t(language, "confirm.noResponder")}
            </p>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.26} y={10} className="space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-center rounded-xl bg-[var(--foreground)] px-4 py-[16px] text-[17px] font-semibold text-white"
          onClick={goTrack}
        >
          {t(language, "confirm.track")}
        </button>
        <button
          type="button"
          className="mx-auto block text-sm font-semibold text-[#2563eb]"
          onClick={() => void copyTrackLink()}
        >
          {linkCopied
            ? t(language, "confirm.linkCopied")
            : t(language, "confirm.copyTrackLink")}
        </button>
      </FadeIn>

      <FadeIn delay={0.3} y={10}>
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {t(language, "confirm.nextTitle")}
          </p>
          <div className="mt-3.5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {t(language, "confirm.next1Title")}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted)]">
                {t(language, "confirm.next1Body")}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {t(language, "confirm.next2Title")}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-[var(--muted)]">
                {t(language, "confirm.next2Body")}
              </p>
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.34} y={10}>
        <button
          type="button"
          className="flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-[14px] text-[15px] font-semibold text-[var(--foreground)]"
          onClick={() => router.push("/report-incident")}
        >
          {t(language, "confirm.home")}
        </button>
      </FadeIn>

      <FadeIn delay={0.38} y={10}>
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {t(language, "confirm.keepTitle")}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {t(language, "confirm.keepBody")}
          </p>
        </div>
      </FadeIn>

      <Danger911Banner language={language} variant="soft" />

      <p className="text-center text-xs leading-relaxed text-[var(--muted)]">
        {t(language, "situation.noAccountNote")}
      </p>

      <CitizenFooter language={language} tight />
    </motion.div>
  );
}
