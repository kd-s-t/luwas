"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CitizenReportForm } from "@/components/CitizenReportForm";
import { PublicShell } from "@/components/PublicShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen, isOfficer } from "@/lib/auth/types";
import { getHazardReportById } from "@/lib/reports/api";
import type { HazardReport } from "@/lib/reports/types";

/** Resume a draft (or redirect submitted reports to the received screen). */
export default function ReportIncidentDraftPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = typeof params.id === "string" ? params.id : "";
  const id = decodeURIComponent(rawId);
  const { profile, loading: authLoading } = useAuth();
  const author =
    profile && (isCitizen(profile) || isOfficer(profile)) ? profile : null;

  const [report, setReport] = useState<HazardReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoadError("Missing report id");
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const row = await getHazardReportById(id);
        if (cancelled) return;
        if (!row) {
          setLoadError("Report not found");
          setReport(null);
          return;
        }
        if (row.status !== "draft") {
          router.replace(
            `/report-incident/received/${encodeURIComponent(row.id)}`,
          );
          return;
        }
        setReport(row);
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Could not load report",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return (
    <PublicShell hideFooter hideNav>
      <div className="min-h-screen bg-[var(--surface-raised)]">
        <main className="mx-auto max-w-md px-4 pt-3 pb-10 sm:px-5">
          {loading || authLoading ? (
            <p className="py-16 text-center text-sm text-[var(--muted)]">
              Loading report…
            </p>
          ) : loadError || !report ? (
            <div className="space-y-4 py-16 text-center">
              <p className="text-sm text-[var(--danger)]">
                {loadError ?? "Report not found"}
              </p>
              <button
                type="button"
                className="text-sm font-semibold underline"
                onClick={() => router.push("/report-incident")}
              >
                Start a new report
              </button>
            </div>
          ) : (
            <CitizenReportForm
              key={report.id}
              author={author}
              draft={report}
            />
          )}
        </main>
      </div>
    </PublicShell>
  );
}
