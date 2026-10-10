import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { OrgPyramid } from "@/components/OrgPyramid";
import { ResponderStationsList } from "@/components/ResponderStationsList";
import { MotionShell } from "@/components/motion/MotionShell";
import { buildBarangayPyramid } from "@/lib/geo/barangayOrg";
import {
  CEBU_BARANGAY_INDEX,
  findBarangay,
  lguKindLabel,
  slugify,
} from "@/lib/geo/cebuBarangays";
import { respondersForBarangay } from "@/lib/geo/responderStations";

type PageProps = {
  params: Promise<{ lgu: string; barangay: string }>;
};

export function generateStaticParams() {
  return CEBU_BARANGAY_INDEX.lgus.flatMap((lgu) =>
    lgu.barangays.map((barangay) => ({
      lgu: slugify(lgu.name),
      barangay: slugify(barangay),
    })),
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { lgu: lguSlug, barangay: brgySlug } = await params;
  const hit = findBarangay(lguSlug, brgySlug);
  if (!hit) return { title: "Barangay · LUWAS" };
  return {
    title: `${hit.barangay}, ${hit.lgu.name} · LUWAS`,
    description: `Government employee hierarchy for Brgy. ${hit.barangay}, ${hit.lgu.name}, Cebu.`,
  };
}

export default async function BarangayDetailPage({ params }: PageProps) {
  const { lgu: lguSlug, barangay: brgySlug } = await params;
  const hit = findBarangay(lguSlug, brgySlug);
  if (!hit) notFound();

  const levels = buildBarangayPyramid(hit.lgu.name, hit.barangay);
  const responders = respondersForBarangay(hit.lgu.name, hit.barangay);

  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow={`${lguKindLabel(hit.lgu.kind)} · ${hit.lgu.name}`}
        title={`Brgy. ${hit.barangay}`}
        description={
          <>
            Hierarchy pyramid · Local Government Code structure
            <br />
            <Link
              href="/barangays"
              className="mt-2 inline-block text-[var(--accent)] underline-offset-2 hover:underline"
            >
              ← All barangays
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <MotionShell delay={0.06}>
          <p className="mb-4 border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3 py-2 text-xs text-[var(--muted)]">
            Officer names are <strong>fictional placeholders</strong> for Cup /
            training — not official DILG or COMELEC rolls. Responder stations
            are directory estimates for ops simulation.
          </p>
          <p className="mb-6 text-sm text-[var(--muted)]">
            Officers can activate this barangay for command ops:{" "}
            <Link
              href={`/command/onboard?area=${encodeURIComponent(`${lguSlug}/${brgySlug}`)}`}
              className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Start onboarding →
            </Link>
          </p>
        </MotionShell>

        <MotionShell delay={0.1}>
          <div className="mb-10">
            <ResponderStationsList stations={responders} />
          </div>
        </MotionShell>

        <MotionShell delay={0.16}>
          <OrgPyramid levels={levels} />
        </MotionShell>
      </main>
    </PublicShell>
  );
}
