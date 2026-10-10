"use client";

import { useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { isMobileClient } from "@/lib/reports/captureMeta";
import { setPendingReportMedia } from "@/lib/reports/pendingMedia";
import { cn } from "@/lib/utils";

type PostReportButtonProps = {
  className?: string;
  active?: boolean;
};

/**
 * Opens the report wizard (no login required, same as iOS).
 * Mobile: open rear camera in this tap, then land on the form with media.
 */
export function PostReportButton({
  className,
  active = false,
}: PostReportButtonProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function goUpload() {
    router.push("/report-incident");
  }

  function onClick() {
    if (typeof window === "undefined") return;
    if (!isMobileClient()) {
      goUpload();
      return;
    }
    inputRef.current?.click();
  }

  function onCapture(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    if (!file) return;
    setPendingReportMedia(file);
    router.push("/report-incident");
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onCapture}
      />
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "border px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase transition",
          active
            ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--on-accent)]"
            : "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-dim)]",
          className,
        )}
      >
        Post a report
      </button>
    </>
  );
}
