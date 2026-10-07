"use client";

import { motion, useReducedMotion } from "framer-motion";
import { HomeCta } from "@/components/HomeCta";
import { HomeFooter } from "@/components/HomeFooter";
import { HomeNav } from "@/components/HomeNav";
import { PublicSituationMap } from "@/components/PublicSituationMap";
import {
  easeOut,
  FadeIn,
  FadeItem,
  Stagger,
} from "@/components/motion/primitives";

export default function HomePage() {
  const reduce = useReducedMotion();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <HomeNav />

      <motion.div
        className="pointer-events-none absolute inset-0 dro-hero-map"
        aria-hidden
        initial={reduce ? false : { opacity: 0.7, scale: 1.03 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: easeOut }}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--surface)] via-[var(--surface)]/85 to-transparent"
        aria-hidden
      />

      <Stagger className="relative z-10 flex min-h-screen flex-col justify-end px-4 pb-16 pt-28 sm:justify-center sm:px-8 sm:pb-24 sm:pt-20 lg:max-w-[58%]">
        <FadeItem>
          <p className="font-mono text-xs tracking-[0.28em] text-[var(--accent)] uppercase">
            Barangay · LGU · DRRM
          </p>
        </FadeItem>

        <FadeItem>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-5xl font-semibold leading-[0.95] tracking-wide text-[var(--foreground)] sm:text-6xl md:text-7xl lg:text-8xl">
            Luwas
          </h1>
        </FadeItem>

        <FadeItem>
          <p className="mt-4 max-w-lg font-mono text-[11px] tracking-[0.14em] text-[var(--accent)] uppercase sm:text-xs">
            Logistics &amp; Unified Workflow for Aid &amp; Safety
          </p>
        </FadeItem>

        <FadeItem>
          <p className="mt-4 max-w-md text-base leading-relaxed text-[var(--muted)] sm:text-lg">
            Command-center software for Philippine barangays — turn a hazard into
            household needs, resource moves, and the right alerts.
          </p>
        </FadeItem>

        <FadeItem>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <HomeCta />
            <a
              href="#live-map"
              className="font-mono text-xs tracking-wider text-[var(--muted)] uppercase underline-offset-4 hover:text-[var(--accent)] hover:underline"
            >
              View live map ↓
            </a>
          </div>
        </FadeItem>

        <FadeItem>
          <p className="mt-8 font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
            <span className="dro-pulse-dot mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)] align-middle" />
            Guidance for responders · not a life-safety guarantee
          </p>
        </FadeItem>
      </Stagger>

      <FadeIn delay={0.15} y={18}>
        <PublicSituationMap />
      </FadeIn>

      <FadeIn delay={0.05} y={16}>
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
      </FadeIn>

      <HomeFooter />
    </div>
  );
}
