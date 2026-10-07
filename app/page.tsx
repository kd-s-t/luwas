import { HomeCta } from "@/components/HomeCta";
import { HomeNav } from "@/components/HomeNav";
import { PublicSituationMap } from "@/components/PublicSituationMap";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <HomeNav />

      {/* Full-bleed ops map plane */}
      <div
        className="pointer-events-none absolute inset-0 dro-hero-map"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--surface)] via-[var(--surface)]/85 to-transparent"
        aria-hidden
      />

      <main className="relative z-10 flex min-h-screen flex-col justify-end px-4 pb-16 pt-28 sm:justify-center sm:px-8 sm:pb-24 sm:pt-20 lg:max-w-[58%]">
        <p className="dro-fade-up font-mono text-xs tracking-[0.28em] text-[var(--accent)] uppercase">
          Barangay · LGU · DRRM
        </p>

        <h1 className="dro-fade-up dro-delay-1 mt-3 font-[family-name:var(--font-display)] text-5xl font-semibold leading-[0.95] tracking-wide text-[var(--foreground)] sm:text-6xl md:text-7xl lg:text-8xl">
          Luwas
        </h1>

        <p className="dro-fade-up dro-delay-2 mt-5 max-w-md text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          Barangay DRRM command center — turn a hazard into household needs,
          resource moves, and the right alerts.
        </p>

        <div className="dro-fade-up dro-delay-3 mt-8 flex flex-wrap items-center gap-4">
          <HomeCta />
          <a
            href="#live-map"
            className="font-mono text-xs tracking-wider text-[var(--muted)] uppercase underline-offset-4 hover:text-[var(--accent)] hover:underline"
          >
            View live map ↓
          </a>
        </div>

        <p className="dro-fade-up dro-delay-4 mt-8 font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
          <span className="dro-pulse-dot mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)] align-middle" />
          Guidance for responders · not a life-safety guarantee
        </p>
      </main>

      <PublicSituationMap />

      <section className="relative z-10 border-t border-[var(--border)] bg-[var(--surface-raised)] px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide sm:text-4xl">
            Built for the barangay desk
          </h2>
          <p className="mt-3 max-w-xl text-[var(--muted)]">
            Capitan and DRRM officers open one situation board: hazard context
            in, Gemini-assisted needs and resource routing out, then push, SMS,
            or email to the right purok contacts.
          </p>
        </div>
      </section>
    </div>
  );
}
