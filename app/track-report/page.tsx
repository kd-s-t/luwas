import { Suspense } from "react";
import { PublicShell } from "@/components/PublicShell";
import { TrackReportForm } from "@/components/TrackReportForm";

export default function TrackReportPage() {
  return (
    <PublicShell hideFooter hideNav>
      <div className="min-h-screen bg-[var(--surface)]">
        <main className="mx-auto max-w-md px-4 pt-0 pb-10 sm:px-5">
          <Suspense fallback={null}>
            <TrackReportForm />
          </Suspense>
        </main>
      </div>
    </PublicShell>
  );
}
