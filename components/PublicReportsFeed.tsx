"use client";

import { useEffect, useState } from "react";
import { PublicReportCard } from "@/components/PublicReportCard";
import { FadeIn } from "@/components/motion/primitives";
import { subscribePublicReports } from "@/lib/reports/socialApi";
import type { HazardReport } from "@/lib/reports/types";

export function PublicReportsFeed() {
  const [rows, setRows] = useState<HazardReport[] | null>(null);

  useEffect(() => {
    return subscribePublicReports(setRows);
  }, []);

  if (rows == null) {
    return (
      <p className="font-mono text-sm tracking-wider text-[var(--muted)] uppercase">
        Loading reports…
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-10 text-center">
        <p className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
          No reports yet
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Citizens can upload field photos and videos after signing in. Verified
          and open reports appear here for the community.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {rows.map((report, i) => (
        <FadeIn key={report.id} delay={Math.min(i * 0.04, 0.24)} y={12}>
          <PublicReportCard report={report} />
        </FadeIn>
      ))}
    </div>
  );
}
