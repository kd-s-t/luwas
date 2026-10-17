"use client";

import { cn } from "@/lib/utils";

const STEPS = [
  { n: 1, label: "Compare options" },
  { n: 2, label: "Review plan & approve" },
  { n: 3, label: "Track delivery" },
] as const;

export function AllocationPlanStepper({
  current,
  className,
}: {
  /** 1-based step index. */
  current: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <nav
      className={cn("w-full max-w-3xl", className)}
      aria-label="Allocation plan steps"
    >
      <ol className="grid grid-cols-3">
        {STEPS.map((step, i) => {
          const done = step.n < current;
          const active = step.n === current;
          const upcoming = step.n > current;
          return (
            <li key={step.n} className="relative min-w-0">
              {i < STEPS.length - 1 ? (
                <span
                  className={cn(
                    "pointer-events-none absolute top-[13px] left-[13px] z-0 h-0.5 w-full",
                    done ? "bg-[#16794c]" : "bg-[#e2e8f0]",
                  )}
                  aria-hidden
                >
                  {active ? (
                    <span className="absolute inset-y-0 left-0 w-[38%] bg-[#2f5f9e]" />
                  ) : null}
                </span>
              ) : null}
              <span
                className={cn(
                  "relative z-[1] flex size-[26px] shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                  done && "bg-[#16794c] text-white",
                  active && "bg-[#2f5f9e] text-white",
                  upcoming &&
                    "border-2 border-[#cbd5e1] bg-white text-[var(--muted)]",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? (
                  <svg
                    viewBox="0 0 16 16"
                    className="size-3.5"
                    aria-hidden
                    fill="none"
                  >
                    <path
                      d="M3.5 8.5 6.5 11.5 12.5 4.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  step.n
                )}
              </span>
              <p
                className={cn(
                  "mt-2 text-[13px] font-semibold leading-snug",
                  active
                    ? "text-[#2f5f9e]"
                    : "text-[var(--foreground)]",
                )}
              >
                {step.label}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-[12px] leading-snug",
                  done && "text-[var(--muted)]",
                  active && "text-[#6b9bd1]",
                  upcoming && "text-[var(--muted)]",
                )}
              >
                {done ? "Completed" : active ? "Current step" : "Next"}
              </p>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
