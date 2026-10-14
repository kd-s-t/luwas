"use client";

import { ScenarioSwitcher } from "@/components/ScenarioSwitcher";
import { CAT5_SCENARIOS } from "@/lib/scenarios";
import { useScenario } from "@/lib/scenarios/ScenarioProvider";
import { cn } from "@/lib/utils";

/**
 * Before / During / After — floats on the situation map (home + command).
 */
export function ScenarioMapOverlay({ className }: { className?: string }) {
  const { phase, setPhase, simulationOn } = useScenario();
  if (!simulationOn) return null;
  const bundle = CAT5_SCENARIOS[phase];

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-2 z-[1100] flex justify-center px-2 sm:top-3 sm:px-3",
        className,
      )}
    >
      <div className="pointer-events-auto" title={bundle.blurb}>
        <ScenarioSwitcher
          phase={phase}
          onChange={setPhase}
          className="shadow-md [&_[role=tablist]]:border-[var(--border)]/80 [&_[role=tablist]]:bg-[var(--surface-raised)]/92 [&_[role=tablist]]:backdrop-blur-md"
        />
      </div>
    </div>
  );
}
