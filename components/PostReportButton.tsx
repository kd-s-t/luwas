"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type PostReportButtonProps = {
  className?: string;
  active?: boolean;
};

/** Opens the citizen report wizard (no login required). */
export function PostReportButton({
  className,
  active = false,
}: PostReportButtonProps) {
  return (
    <Link
      href="/report-incident"
      className={cn(
        "rounded-xl border px-3 py-1.5 font-mono text-[10px] tracking-wider uppercase transition",
        active
          ? "border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--on-accent)]"
          : "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent-dim)]",
        className,
      )}
    >
      Post a report
    </Link>
  );
}
