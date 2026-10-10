"use client";

import { CitizenReportForm } from "@/components/CitizenReportForm";
import { PublicShell } from "@/components/PublicShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen, isOfficer } from "@/lib/auth/types";

/** iOS-parity report wizard — guests welcome; signed-in users keep their identity. */
export default function ReportIncidentPage() {
  const { profile, loading } = useAuth();
  const author =
    profile && (isCitizen(profile) || isOfficer(profile)) ? profile : null;

  return (
    <PublicShell hideFooter hideNav>
      <div className="min-h-screen bg-[var(--surface-raised)]">
        <main className="mx-auto max-w-md px-4 pt-3 pb-10 sm:px-5">
          <CitizenReportForm
            key={author?.uid ?? (loading ? "boot" : "guest")}
            author={loading ? null : author}
          />
        </main>
      </div>
    </PublicShell>
  );
}
