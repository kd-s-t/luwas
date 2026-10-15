import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { TrackReportForm } from "@/components/TrackReportForm";

export default function TrackReportPage() {
  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="Citizen"
        title="Track report"
        description="Enter your reference number to open status and updates for a report filed from this device or with a shared id."
      />
      <main className="mx-auto max-w-md px-4 py-8 sm:px-6">
        <TrackReportForm />
      </main>
    </PublicShell>
  );
}
