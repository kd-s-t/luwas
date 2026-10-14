"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { easeOut, useMotionSafe } from "@/components/motion/primitives";

/** Soft enter on public routes. Skip shell routes so the left nav never animates. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Defer motion until after mount so SSR HTML matches the first client paint
  // (useReducedMotion alone is null on the server and can flip on the client).
  const safe = useMotionSafe();

  const skipShell =
    pathname.startsWith("/admin") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/my-reports" ||
    pathname.startsWith("/my-reports/");

  if (!safe || skipShell) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
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
