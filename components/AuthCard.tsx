"use client";

import { motion, useReducedMotion } from "framer-motion";
import { HomeNav } from "@/components/HomeNav";
import { easeOut } from "@/components/motion/primitives";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  const reduce = useReducedMotion();

  return (
    <div className="flex min-h-screen flex-col">
      <HomeNav />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10">
        <motion.div
          className="w-full max-w-md border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_8px_28px_rgba(31,33,38,0.06)]"
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
    </div>
  );
}
