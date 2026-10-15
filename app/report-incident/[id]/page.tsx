"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CitizenReportForm } from "@/components/CitizenReportForm";
import { PublicShell } from "@/components/PublicShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen, isOfficer } from "@/lib/auth/types";
import { getHazardReportById } from "@/lib/reports/api";
import { hasGuestReportId } from "@/lib/reports/guestReportStore";
import type { HazardReport } from "@/lib/reports/types";

const GUEST_EDITABLE = new Set(["draft", "queued", "needs_review", "rejected"]);

/** Resume draft, or edit a submitted guest report saved on this device. */
export default function ReportIncidentDraftPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = typeof params.id === "string" ? params.id : "";
  const id = decodeURIComponent(rawId);
  const { profile, loading: authLoading } = useAuth();
  const author =
    profile && (isCitizen(profile) || isOfficer(profile)) ? profile : null;

  const [report, setReport] = useState<HazardReport | null>(null);
  const [editMode, setEditMode] = useState(false);
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
        if (row.status === "draft") {
          setEditMode(false);
          setReport(row);
          return;
        }
        const deviceToken = hasGuestReportId(row.id);
        const canGuestEdit =
          deviceToken &&
          row.citizenUid === "web-guest" &&
          GUEST_EDITABLE.has(row.status);
        if (canGuestEdit) {
          setEditMode(true);
          setReport(row);
          return;
        }
        router.replace(
          `/report-incident/received/${encodeURIComponent(row.id)}`,
        );
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
      <div className="flex min-h-dvh flex-col overflow-x-hidden bg-[var(--surface)]">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-0 sm:px-5">
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
              key={`${report.id}-${editMode ? "edit" : "draft"}`}
              author={author}
              draft={report}
              editMode={editMode}
            />
          )}
        </main>
      </div>
    </PublicShell>
  );
}
