import Link from "next/link";
import { HomeFooter } from "@/components/HomeFooter";
import { ResponderStationsList } from "@/components/ResponderStationsList";
import {
  MotionItem,
  MotionShell,
  MotionStagger,
} from "@/components/motion/MotionShell";
import {
  CEBU_BARANGAY_INDEX,
  lguKindLabel,
  slugify,
  totalBarangayCount,
  type CebuLgu,
  type LguKind,
} from "@/lib/geo/cebuBarangays";
import { respondersForLgu } from "@/lib/geo/responderStations";

export const metadata = {
  title: "Cebu barangays · Luwas",
  description:
    "Directory of barangays across Cebu province and highly urbanized cities, with barangay government hierarchy.",
};

const KIND_ORDER: LguKind[] = [
  "highly_urbanized_city",
  "component_city",
  "municipality",
];

function groupByKind(lgus: CebuLgu[]) {
  return KIND_ORDER.map((kind) => ({
    kind,
    lgus: lgus.filter((l) => l.kind === kind),
  })).filter((g) => g.lgus.length > 0);
}

export default function BarangaysPage() {
  const groups = groupByKind(CEBU_BARANGAY_INDEX.lgus);
  const total = totalBarangayCount();

  return (
    <div className="min-h-screen">
      <MotionShell>
        <header className="border-b border-[var(--border)] bg-[var(--surface-raised)]/90 px-4 py-4 backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
                Directory · Cebu
              </p>
              <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide sm:text-4xl">
                Barangays
              </h1>
              <p className="mt-1 max-w-xl text-sm text-[var(--muted)]">
                {total.toLocaleString()} barangays across{" "}
                {CEBU_BARANGAY_INDEX.lgus.length} cities &amp; municipalities.
                Each LGU lists covering PNP / BFP stations; open a barangay for
                local tanod outposts when known.
              </p>
            </div>
            <nav className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/"
                className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                Home
              </Link>
              <Link
                href="/command"
                className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                Command
              </Link>
            </nav>
          </div>
        </header>
      </MotionShell>

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

        <MotionStagger className="space-y-10">
          {groups.map(({ kind, lgus }) => (
            <MotionItem key={kind}>
              <section>
                <h2 className="font-mono text-[10px] tracking-[0.2em] text-[var(--warn)] uppercase">
                  {lguKindLabel(kind)}
                </h2>
                <ul className="mt-3 space-y-4">
                  {lgus.map((lgu) => (
                    <li
                      key={lgu.name}
                      className="border border-[var(--border)] bg-[var(--surface-raised)]"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                        <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
                          {lgu.name}
                        </h3>
                        <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                          {lgu.barangays.length} barangays
                        </p>
                      </div>
                      <ResponderStationsList
                        stations={respondersForLgu(lgu.name)}
                        compact
                      />
                      <ul className="flex flex-wrap gap-2 border-t border-[var(--border)] px-4 py-4">
                        {lgu.barangays.map((b) => {
                          const href = `/barangays/${slugify(lgu.name)}/${slugify(b)}`;
                          const highlight =
                            lgu.name === "Consolacion" && b === "Nangka";
                          return (
                            <li key={b}>
                              <Link
                                href={href}
                                className={`inline-block border px-2.5 py-1 text-sm transition ${
                                  highlight
                                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                                    : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                }`}
                              >
                                {b}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            </MotionItem>
          ))}
        </MotionStagger>
      </main>

      <HomeFooter />
    </div>
  );
}
