"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Phone } from "lucide-react";
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
}: {
  language: CitizenLang;
  onLanguageChange?: (lang: CitizenLang) => void;
  showBack?: boolean;
  onBack?: () => void;
  /** History back (falls back to site home if no prior page). */
  showHomeLink?: boolean;
}) {
  const router = useRouter();

  function goWhereYouCameFrom() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
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
          className="text-[22px] font-bold tracking-tight text-[var(--foreground)] transition hover:text-[var(--danger)]"
        >
          Luwas
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

export function Danger911Banner({ language }: { language: CitizenLang }) {
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

export function CitizenFooter({ language }: { language: CitizenLang }) {
  return (
    <div className="space-y-1.5 py-4 text-center">
      <p className="text-xs text-[var(--muted)]">
        {t(language, "footer.tagline")}
      </p>
      <div className="flex items-center justify-center gap-4 text-[11px] font-medium text-[var(--muted)]">
        <Link href="/support" className="hover:text-[var(--foreground)]">
          {t(language, "footer.accessibility")}
        </Link>
        <Link href="/privacy" className="hover:text-[var(--foreground)]">
          {t(language, "footer.privacy")}
        </Link>
      </div>
    </div>
  );
}

export function StepProgress({
  step,
  title,
  language,
}: {
  step: number;
  title: string;
  language: CitizenLang;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--muted)] uppercase">
        {t(language, "step.progress", {
          step: String(step),
          title,
        })}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--border)]">
        <div
          className="h-full rounded-full bg-[var(--foreground)] transition-[width] duration-300 ease-out"
          style={{ width: `${(step / 3) * 100}%` }}
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
