"use client";

import { ScenarioSwitcher } from "@/components/ScenarioSwitcher";
import { CAT5_SCENARIOS } from "@/lib/scenarios";
import { useScenario } from "@/lib/scenarios/ScenarioProvider";
import { cn } from "@/lib/utils";

type ScenarioMapOverlayProps = {
  className?: string;
  /**
   * bar = chrome above the map (never covered by InfoWindows).
   * float = over the map (legacy; can sit under Google popups).
   */
  variant?: "bar" | "float";
};

/**
 * Before / During / After — prefer `bar` so map InfoWindows cannot cover it.
 */
export function ScenarioMapOverlay({
  className,
  variant = "bar",
}: ScenarioMapOverlayProps) {
  const { phase, setPhase, simulationOn } = useScenario();
  if (!simulationOn) return null;
  const bundle = CAT5_SCENARIOS[phase];

  if (variant === "bar") {
    return (
      <div
        className={cn(
          "relative z-30 flex shrink-0 justify-end border-b border-[var(--border)] bg-[var(--surface-panel)] px-2 py-2 sm:px-3",
          className,
        )}
        title={bundle.blurb}
      >
        <ScenarioSwitcher phase={phase} onChange={setPhase} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-2 z-[2147483000] flex justify-center px-2 sm:top-3 sm:px-3",
        className,
      )}
    >
      <div
        className="pointer-events-auto relative"
        title={bundle.blurb}
      >
        <ScenarioSwitcher
          phase={phase}
          onChange={setPhase}
          className="shadow-md [&_[role=tablist]]:border-[var(--border)]/80 [&_[role=tablist]]:bg-[var(--surface-raised)]/92 [&_[role=tablist]]:backdrop-blur-md"
        />
      </div>
    </div>
  );
}
