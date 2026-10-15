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
      <div className="flex min-h-dvh flex-col overflow-x-hidden bg-[var(--surface)]">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-0 sm:px-5">
          <CitizenReportForm
            key={author?.uid ?? "guest"}
            author={loading ? null : author}
          />
        </main>
      </div>
    </PublicShell>
  );
}
