import { Suspense } from "react";
import { PublicShell } from "@/components/PublicShell";
import { TrackReportForm } from "@/components/TrackReportForm";

export default function TrackReportPage() {
  return (
    <PublicShell hideFooter hideNav>
      <div className="flex min-h-dvh flex-col overflow-x-hidden bg-[var(--surface)]">
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-0 sm:px-5">
          <Suspense fallback={null}>
            <TrackReportForm />
          </Suspense>
        </main>
      </div>
    </PublicShell>
  );
}
