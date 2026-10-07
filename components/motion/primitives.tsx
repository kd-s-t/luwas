"use client";

import {
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from "framer-motion";
import type { ReactNode } from "react";

export const easeOut = [0.22, 1, 0.36, 1] as const;

export function useMotionSafe() {
  const reduce = useReducedMotion();
  return !reduce;
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: easeOut },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.4, ease: easeOut },
  },
};

export const stagger: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

type FadeProps = HTMLMotionProps<"div"> & {
  children: ReactNode;
  delay?: number;
  y?: number;
};

/** Single fade/slide-in block. Honors prefers-reduced-motion. */
export function FadeIn({
  children,
  className,
  delay = 0,
  y = 12,
  ...rest
}: FadeProps) {
  const safe = useMotionSafe();
  if (!safe) {
    return (
      <div className={className} {...(rest as object)}>
        {children}
      </div>
    );
  }
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: easeOut }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

type StaggerProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
};

/** Parent for staggered FadeItem children. */
export function Stagger({ children, className, delay = 0 }: StaggerProps) {
  const safe = useMotionSafe();
  if (!safe) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      className={className}
      variants={stagger}
      initial="hidden"
      animate="show"
      transition={{ delayChildren: delay }}
    >
      {children}
    </motion.div>
  );
}

export function FadeItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const safe = useMotionSafe();
  if (!safe) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}
