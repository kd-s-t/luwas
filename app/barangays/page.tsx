import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { BarangaysDirectory } from "@/components/BarangaysDirectory";
import { MotionShell } from "@/components/motion/MotionShell";
import {
  CEBU_BARANGAY_INDEX,
  totalBarangayCount,
} from "@/lib/geo/cebuBarangays";

export const metadata = {
  title: "Cebu barangays · Luwas",
  description:
    "Directory of barangays across Cebu province and highly urbanized cities, with barangay government hierarchy.",
};

export default function BarangaysPage() {
  const total = totalBarangayCount();

  return (
    <PublicShell>
      <PublicPageHeader
        wide
        eyebrow="Directory · Cebu"
        title="Barangays"
        description={
          <>
            {total.toLocaleString()} barangays across{" "}
            {CEBU_BARANGAY_INDEX.lgus.length} cities &amp; municipalities. Search
            or jump to an LGU for PNP, BFP, and hospital contacts; open a
            barangay for local tanod outposts when known.
          </>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <MotionShell delay={0.06}>
          <p className="mb-6 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
            Source ·{" "}
            <a
              href={CEBU_BARANGAY_INDEX.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              PhilAtlas
            </a>{" "}
            · ops focus Consolacion · Nangka
          </p>
        </MotionShell>

        <BarangaysDirectory />
      </main>
    </PublicShell>
  );
}
