"use client";

import dynamic from "next/dynamic";

const PublicSituationMap = dynamic(
  () =>
    import("@/components/PublicSituationMap").then((m) => m.PublicSituationMap),
  {
    ssr: false,
    loading: () => (
      <section
        id="live-map"
        className="relative z-10 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-16 sm:px-8 sm:py-20"
      >
        <p className="font-mono text-xs tracking-[0.25em] text-[var(--muted)] uppercase">
          Live map · loading…
        </p>
      </section>
    ),
  },
);

/** Lazy client map so the hero paints before Leaflet / weather / GPS. */
export function HomeLiveMap() {
  return <PublicSituationMap />;
}
