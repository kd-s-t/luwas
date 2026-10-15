"use client";

import {
  CAT5_SCENARIOS,
  SCENARIO_PHASES,
  isSimulationOn,
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
  if (!isSimulationOn()) return null;

  return (
    <div className={cn("flex shrink-0", className)}>
      <div
        role="tablist"
        aria-label="DRRM scenario phase"
        className="inline-flex overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)]"
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
                "min-w-[3.25rem] whitespace-nowrap px-2.5 py-1.5 font-mono text-[9px] tracking-wider uppercase transition",
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
