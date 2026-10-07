"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { easeOut, FadeItem, Stagger } from "@/components/motion/primitives";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  const reduce = useReducedMotion();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Stagger className="mb-8 text-center" delay={0.02}>
        <FadeItem>
          <p className="font-mono text-xs tracking-[0.25em] text-[var(--accent)] uppercase">
            Command access
          </p>
        </FadeItem>
        <FadeItem>
          <Link
            href="/"
            className="mt-2 block font-[family-name:var(--font-display)] text-4xl font-semibold tracking-wide text-[var(--foreground)] sm:text-5xl"
          >
            Luwas
          </Link>
        </FadeItem>
        <FadeItem>
          <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-[var(--muted)] uppercase">
            Logistics &amp; Unified Workflow for Aid &amp; Safety
          </p>
        </FadeItem>
      </Stagger>

      <motion.div
        className="w-full max-w-md border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_8px_28px_rgba(15,42,28,0.06)]"
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, delay: 0.12, ease: easeOut }}
      >
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
          {footer}
        </div>
      </motion.div>
    </div>
  );
}
