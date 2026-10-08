import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { PublicReportsFeed } from "@/components/PublicReportsFeed";

export default function PublicReportsPage() {
  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="Community"
        title="Field reports"
        description="Photos and videos from your barangay only, nearest to you first. Signed-in users can react and comment."
      />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <PublicReportsFeed />
      </main>
    </PublicShell>
  );
}
