"use client";

import type { ReactNode } from "react";
import { FadeIn, Stagger, FadeItem } from "@/components/motion/primitives";

/** Drop-in animated shell for server-rendered page bodies. */
export function MotionShell({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <FadeIn className={className} delay={delay} y={12}>
      {children}
    </FadeIn>
  );
}

export function MotionStagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <Stagger className={className}>{children}</Stagger>;
}

export function MotionItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <FadeItem className={className}>{children}</FadeItem>;
}
