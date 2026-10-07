import Link from "next/link";
import { notFound } from "next/navigation";
import { HomeFooter } from "@/components/HomeFooter";
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
  if (!hit) return { title: "Barangay · Luwas" };
  return {
    title: `${hit.barangay}, ${hit.lgu.name} · Luwas`,
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
    <div className="min-h-screen">
      <MotionShell>
        <header className="border-b border-[var(--border)] bg-[var(--surface-raised)]/90 px-4 py-4 backdrop-blur sm:px-8">
          <div className="mx-auto max-w-4xl">
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              {lguKindLabel(hit.lgu.kind)} · {hit.lgu.name}
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide sm:text-4xl">
              Brgy. {hit.barangay}
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Hierarchy pyramid · Local Government Code structure
            </p>
            <nav className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link
                href="/barangays"
                className="text-[var(--accent)] underline-offset-2 hover:underline"
              >
                ← All barangays
              </Link>
              <Link
                href="/"
                className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                Home
              </Link>
            </nav>
          </div>
        </header>
      </MotionShell>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        <MotionShell delay={0.06}>
          <p className="mb-6 border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3 py-2 text-xs text-[var(--muted)]">
            Officer names are <strong>demo placeholders</strong> for Cup /
            training — not official DILG or COMELEC rolls. Responder stations
            are directory estimates for ops demos.
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

      <HomeFooter />
    </div>
  );
}
