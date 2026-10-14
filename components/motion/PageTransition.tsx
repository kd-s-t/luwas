"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { easeOut } from "@/components/motion/primitives";

/** Soft enter on public routes. Skip shell routes so the left nav never animates. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  const skipShell =
    pathname.startsWith("/admin") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/my-reports" ||
    pathname.startsWith("/my-reports/");

  if (reduce || skipShell) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.32, ease: easeOut }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
