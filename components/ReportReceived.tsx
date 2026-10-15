"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  CitizenFooter,
  CitizenHeader,
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

export function ReportReceived({
  referenceId,
  guest = true,
}: ReportReceivedProps) {
  const router = useRouter();
  const motionSafe = useMotionSafe();
  const [language, setLanguage] = useState<CitizenLang>("en");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    saveGuestReportId(referenceId);
  }, [referenceId]);

  const shortRef = referenceId.startsWith("LUW-");

  return (
    <motion.div
      className="space-y-[18px]"
      initial={motionSafe ? { opacity: 0, y: 18 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut }}
    >
      <CitizenHeader
        language={language}
        onLanguageChange={setLanguage}
        showHomeLink
      />
      <div className="flex flex-col items-center gap-2 text-center">
        <motion.div
          className="flex justify-center"
          initial={motionSafe ? { scale: 0.6, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 320,
            damping: 18,
            delay: 0.05,
          }}
        >
          <CheckCircle2
            className="mx-auto size-11 text-[var(--success)]"
            aria-hidden
          />
        </motion.div>
        <FadeIn delay={0.1} y={10} className="w-full text-center">
          <h2 className="text-center text-2xl font-bold text-[var(--foreground)]">
            {t(language, "confirm.title")}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-center text-sm text-[var(--muted)]">
            {t(language, "confirm.body")}
          </p>
        </FadeIn>
      </div>

      <FadeIn delay={0.18} y={12}>
        <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
            {t(language, "confirm.reference")}
          </p>
          <p
            className={cn(
              "mt-2 break-all font-mono font-bold tracking-tight text-[var(--foreground)]",
              shortRef
                ? "text-[28px] leading-tight"
                : "text-[15px] leading-snug sm:text-lg",
            )}
            title={referenceId}
          >
            {referenceId}
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded-[10px] bg-[var(--surface-raised)] py-3 text-sm font-semibold"
            onClick={() => {
              void navigator.clipboard?.writeText(referenceId);
              setCopied(true);
            }}
          >
            {copied
              ? t(language, "common.copied")
              : t(language, "confirm.copy")}
          </button>
        </div>
      </FadeIn>

      <FadeIn delay={0.26} y={10}>
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--warn)]/40 bg-[var(--warn)]/15 p-3.5">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0 text-[var(--warn)]"
            aria-hidden
          />
          <p className="text-sm text-[var(--foreground)]">
            {t(language, "confirm.noResponder")}
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.32} y={10} className="space-y-3">
        <button
          type="button"
          className="flex w-full items-center justify-center rounded-[14px] bg-[var(--foreground)] px-4 py-[16px] text-[17px] font-semibold text-[var(--surface)]"
          onClick={() => {
            if (guest) {
              router.push(`/reports/${referenceId}`);
              return;
            }
            router.push("/my-reports");
          }}
        >
          {t(language, "confirm.track")}
        </button>
        <button
          type="button"
          className="flex w-full items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-[16px] text-[17px] font-semibold text-[var(--foreground)]"
          onClick={() => router.push("/report-incident")}
        >
          {t(language, "confirm.home")}
        </button>
      </FadeIn>
      <CitizenFooter language={language} />
    </motion.div>
  );
}
