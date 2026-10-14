"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { PublicReportCard } from "@/components/PublicReportCard";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getHazardReportById } from "@/lib/reports/api";
import type { HazardReport } from "@/lib/reports/types";
import {
  ensureMapReportInDb,
  findMapReportPin,
} from "@/lib/reports/seedMapReport";

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { profile } = useAuth();
  const [report, setReport] = useState<HazardReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const backHref =
    profile && report && report.citizenUid === profile.uid
      ? "/my-reports"
      : "/reports";
  const backLabel =
    backHref === "/my-reports" ? "← My reports" : "← All reports";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // Guest / citizen / officer reports live in Firestore (public read).
        const fromDb = await getHazardReportById(id);
        if (fromDb) {
          if (!cancelled) setReport(fromDb);
          return;
        }

        // Demo map pins (rpt-*) — seed into Firestore if missing.
        const pin = findMapReportPin(id);
        if (pin?.mediaUrl) {
          const row = await ensureMapReportInDb(pin);
          if (!cancelled) setReport(row);
          return;
        }

        throw new Error("Report not found");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load report");
          setReport(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="Image report"
        title={report?.title ?? "Field report"}
        description={
          <Link
            href={backHref}
            className="text-[var(--accent)] underline-offset-2 hover:underline"
          >
            {backLabel}
          </Link>
        }
      />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {loading ? (
          <p className="font-mono text-sm tracking-wider text-[var(--muted)] uppercase">
            Loading report…
          </p>
        ) : null}
        {error ? (
          <div className="border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-4 text-sm text-[var(--muted)]">
            <p className="font-medium text-[var(--foreground)]">
              Could not open report
            </p>
            <p className="mt-1 font-mono text-[11px]">{error}</p>
          </div>
        ) : null}
        {report ? <PublicReportCard report={report} expandSocial /> : null}
      </main>
    </PublicShell>
  );
}
