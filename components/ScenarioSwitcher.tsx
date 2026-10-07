"use client";

import {
  CAT5_SCENARIOS,
  SCENARIO_PHASES,
  type DrrmScenarioPhase,
} from "@/lib/scenarios";
import { cn } from "@/lib/utils";

type ScenarioSwitcherProps = {
  phase: DrrmScenarioPhase;
  onChange: (phase: DrrmScenarioPhase) => void;
  className?: string;
};

export function ScenarioSwitcher({
  phase,
  onChange,
  className,
}: ScenarioSwitcherProps) {
  return (
    <div className={cn("flex shrink-0", className)}>
      <div
        role="tablist"
        aria-label="DRRM scenario phase"
        className="inline-flex border border-[var(--border)] bg-[var(--surface)]"
      >
        {SCENARIO_PHASES.map((p) => {
          const active = p === phase;
          const bundle = CAT5_SCENARIOS[p];
          return (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(p)}
              className={cn(
                "min-w-[4.75rem] px-3 py-2 font-mono text-[10px] tracking-wider uppercase transition",
                active
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--muted)] hover:bg-[var(--surface-panel)] hover:text-[var(--foreground)]",
              )}
            >
              {bundle.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}
