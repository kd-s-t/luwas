"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ChevronLeft, Globe, Phone } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useMotionSafe } from "@/components/motion/primitives";
import { t, type CitizenLang } from "@/lib/citizen/i18n";
import { cn } from "@/lib/utils";

export type { CitizenLang };

const LANG_LABEL: Record<CitizenLang, string> = {
  en: "English",
  fil: "Filipino",
  ceb: "Cebuano",
};

export function CitizenHeader({
  language,
  onLanguageChange,
  showBack,
  onBack,
  showHomeLink,
  variant = "default",
}: {
  language: CitizenLang;
  onLanguageChange?: (lang: CitizenLang) => void;
  showBack?: boolean;
  onBack?: () => void;
  /** History back (falls back to site home if no prior page). */
  showHomeLink?: boolean;
  /** `brand` = red LUWAS bar (citizen home). */
  variant?: "default" | "brand";
}) {
  const router = useRouter();

  function goWhereYouCameFrom() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }

  if (variant === "brand") {
    const fullBleed = {
      width: "100vw",
      maxWidth: "100vw",
      marginLeft: "calc(50% - 50vw)",
    } as const;
    return (
      <div className="space-y-0">
        <div
          style={fullBleed}
          className="box-border flex items-center bg-[var(--danger)] px-4 py-3.5 sm:px-5"
        >
          <Link
            href="/"
            className="inline-flex transition hover:opacity-90"
            aria-label="LUWAS home"
          >
            <BrandLogo
              tone="inverse"
              size={24}
              wordmarkClassName="text-[20px] font-bold tracking-[0.04em] uppercase"
            />
          </Link>
          <div className="flex-1" />
          <a
            href="tel:911"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white"
          >
            <Phone className="size-3.5 fill-current" aria-hidden />
            911
          </a>
        </div>
        {onLanguageChange ? (
          <div
            style={fullBleed}
            className="box-border flex flex-wrap items-center justify-end gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 sm:px-5"
          >
            <Globe
              className="size-4 shrink-0 text-[#1d4ed8]"
              strokeWidth={2}
              aria-hidden
            />
            {(Object.keys(LANG_LABEL) as CitizenLang[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => onLanguageChange(lang)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold transition",
                  language === lang
                    ? "bg-[#dbeafe] text-[#1d4ed8]"
                    : "bg-transparent text-[var(--muted)]",
                )}
              >
                {language === lang ? (
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                ) : null}
                {LANG_LABEL[lang]}
              </button>
            ))}
          </div>
        ) : null}
        {showBack ? (
          <div className="bg-[var(--surface)] px-0 pt-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--foreground)]"
              aria-label={t(language, "common.back")}
            >
              <ChevronLeft className="size-4" strokeWidth={2.5} aria-hidden />
              {t(language, "common.back")}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2.5 px-0 pt-1">
      {showHomeLink ? (
        <button
          type="button"
          onClick={goWhereYouCameFrom}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          <ChevronLeft className="size-3.5" strokeWidth={2.5} aria-hidden />
          Back
        </button>
      ) : null}
      <div className="flex items-center gap-1">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex size-9 shrink-0 items-center justify-center text-[var(--foreground)]"
            aria-label={t(language, "common.back")}
          >
            <ChevronLeft className="size-5" strokeWidth={2.5} />
          </button>
        ) : null}
        <Link
          href="/"
          className="inline-flex transition hover:opacity-90"
          aria-label="LUWAS home"
        >
          <BrandLogo
            size={26}
            wordmarkClassName="text-[22px] font-bold tracking-tight"
          />
        </Link>
        <div className="flex-1" />
        <a
          href="tel:911"
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-[var(--danger)]/10 px-3 py-2 text-sm font-semibold text-[var(--danger)]"
        >
          <Phone className="size-3.5 fill-current" aria-hidden />
          911
        </a>
      </div>

      {onLanguageChange ? (
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(LANG_LABEL) as CitizenLang[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => onLanguageChange(lang)}
              className={cn(
                "rounded-full px-2.5 py-1.5 text-xs font-semibold transition",
                language === lang
                  ? "bg-[var(--foreground)] text-white"
                  : "bg-transparent text-[var(--muted)]",
              )}
            >
              {LANG_LABEL[lang]}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function Danger911Banner({
  language,
  variant = "solid",
}: {
  language: CitizenLang;
  variant?: "solid" | "soft";
}) {
  if (variant === "soft") {
    return (
      <div className="rounded-2xl border border-[var(--danger)]/20 bg-[#fce8ea] p-4">
        <p className="text-base font-semibold text-[var(--foreground)]">
          {t(language, "danger.immediate")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
          {t(language, "danger.immediateBody")}
        </p>
        <a
          href="tel:911"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--danger)] py-3.5 text-base font-semibold text-white transition hover:bg-[var(--danger)]/92"
        >
          <Phone className="size-4 fill-current" aria-hidden />
          {t(language, "danger.call911")}
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[var(--danger)] p-4">
      <p className="text-sm font-semibold text-white">
        {t(language, "danger.immediate")}
      </p>
      <a
        href="tel:911"
        className="mt-2.5 flex w-full items-center justify-center rounded-xl bg-white py-3.5 text-base font-semibold text-[var(--danger)] transition hover:bg-white/95"
      >
        {t(language, "danger.call911")}
      </a>
    </div>
  );
}

export function CitizenFooter({
  language,
  tight,
}: {
  language: CitizenLang;
  /** Less top pad when stacked under the 911 card. */
  tight?: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: "#e8eaed",
        width: "100vw",
        maxWidth: "100vw",
        marginLeft: "calc(50% - 50vw)",
      }}
      className={cn(
        "relative mt-auto box-border flex min-h-0 flex-1 flex-col border-t border-[var(--border)] text-center",
        tight ? "pt-3 pb-6" : "py-5 pb-8",
      )}
    >
      <div className="mx-auto w-full max-w-md space-y-3 px-4 sm:px-5">
        <p className="text-xs text-[var(--muted)]">
          {t(language, "footer.tagline")}
        </p>
        <div className="flex items-center justify-center gap-4 text-[11px] font-medium text-[#2563eb]">
          <Link href="/support" className="hover:underline">
            Support
          </Link>
          <Link href="/privacy" className="hover:underline">
            {t(language, "footer.privacy")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function HomeFloodTip({ language }: { language: CitizenLang }) {
  return (
    <div className="space-y-2">
      <p className="text-base font-semibold text-[var(--foreground)]">
        {t(language, "home.staySafe")}
      </p>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          {t(language, "home.avoidFloodTitle")}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
          {t(language, "home.avoidFloodBody")}
        </p>
      </div>
      <p className="text-xs leading-relaxed text-[var(--muted)]">
        {t(language, "home.disclaimer")}
      </p>
    </div>
  );
}

export function StepProgress({
  step,
  title,
  language,
  variant = "default",
}: {
  step: number;
  title: string;
  language: CitizenLang;
  variant?: "default" | "brand";
}) {
  const motionSafe = useMotionSafe();
  const brand = variant === "brand";
  return (
    <div>
      <p
        className={cn(
          "text-[12px] font-semibold",
          brand
            ? "text-[#1d4ed8]"
            : "tracking-[0.08em] text-[var(--muted)] uppercase",
        )}
      >
        {t(language, "step.progress", {
          step: String(step),
          title,
        })}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
        <motion.div
          className={cn(
            "h-full rounded-full",
            brand ? "bg-[#2563eb]" : "bg-[var(--foreground)]",
          )}
          initial={false}
          animate={{ width: `${(step / 3) * 100}%` }}
          transition={
            motionSafe
              ? { type: "spring", stiffness: 280, damping: 28 }
              : { duration: 0 }
          }
        />
      </div>
    </div>
  );
}

export function StaySafeCard({ language }: { language: CitizenLang }) {
  const tips = [
    t(language, "home.tipFlood"),
    t(language, "home.tipHigher"),
    t(language, "home.tipPhone"),
  ];
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-base font-semibold text-[var(--foreground)]">
        {t(language, "home.staySafe")}
      </p>
      <ul className="mt-3 space-y-3">
        {tips.map((tip) => (
          <li
            key={tip}
            className="flex items-start gap-2.5 text-sm text-[var(--muted)]"
          >
            <span
              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-white"
              aria-hidden
            >
              <Check className="size-2.5" strokeWidth={3} />
            </span>
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}
