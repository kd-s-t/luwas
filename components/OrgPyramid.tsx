"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { PyramidLevel } from "@/lib/geo/barangayOrg";
import { easeOut } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";

type OrgPyramidProps = {
  levels: PyramidLevel[];
};

export function OrgPyramid({ levels }: OrgPyramidProps) {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[8%] top-2 bottom-2 bg-[var(--accent)]/8"
        style={{
          clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
        }}
      />

      <ol className="relative flex flex-col items-center gap-3 sm:gap-4">
        {levels.map((level, index) => (
          <motion.li
            key={level.id}
            className="w-full"
            style={{ maxWidth: `${level.widthPercent}%` }}
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.4,
              delay: reduce ? 0 : index * 0.07,
              ease: easeOut,
            }}
          >
            <div
              className={cn(
                "border border-[var(--border)] bg-[var(--surface-raised)]/95 px-3 py-3 shadow-[0_6px_20px_rgba(31,33,38,0.06)] sm:px-4",
                index === 0 &&
                  "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]",
              )}
            >
              <p
                className={cn(
                  "text-center font-mono text-[10px] tracking-[0.18em] uppercase",
                  index === 0
                    ? "text-[var(--on-accent)]/80"
                    : "text-[var(--accent)]",
                )}
              >
                {level.label}
              </p>

              <ul
                className={cn(
                  "mt-2 flex flex-wrap justify-center gap-2",
                  level.people.length === 1 && "justify-center",
                )}
              >
                {level.people.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      "min-w-[7.5rem] max-w-[11rem] flex-1 border px-2.5 py-2 text-center",
                      index === 0
                        ? "border-[var(--on-accent)]/35 bg-[var(--on-accent)]/10"
                        : "border-[var(--border)] bg-[var(--surface)]",
                    )}
                  >
                    <p
                      className={cn(
                        "font-mono text-[9px] tracking-wider uppercase",
                        index === 0
                          ? "text-[var(--on-accent)]/75"
                          : "text-[var(--muted)]",
                      )}
                    >
                      {p.role}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-sm font-medium leading-snug",
                        index === 0
                          ? "text-[var(--on-accent)]"
                          : "text-[var(--foreground)]",
                      )}
                    >
                      {p.name}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            {index < levels.length - 1 ? (
              <div
                aria-hidden
                className="mx-auto mt-3 h-3 w-px bg-[var(--border)] sm:mt-4"
              />
            ) : null}
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
