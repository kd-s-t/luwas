"use client";

import type { ReactNode } from "react";
import { ScenarioSwitcher } from "@/components/ScenarioSwitcher";
import { CAT5_SCENARIOS } from "@/lib/scenarios";
import { useScenario } from "@/lib/scenarios/ScenarioProvider";
import { cn } from "@/lib/utils";

type ScenarioMapOverlayProps = {
  className?: string;
  /**
   * bar = chrome above the map (never covered by InfoWindows).
   * float = over the map top (inside map stage).
   */
  variant?: "bar" | "float";
  /** Right-side actions (e.g. Exit) next to the phase pills. */
  trailing?: ReactNode;
};

/**
 * No storm / Before / During / After — `float` sits on the map top.
 */
export function ScenarioMapOverlay({
  className,
  variant = "bar",
  trailing,
}: ScenarioMapOverlayProps) {
  const { phase, setPhase, simulationOn } = useScenario();
  const bundle = CAT5_SCENARIOS[phase];
  const switcher = simulationOn ? (
    <ScenarioSwitcher
      phase={phase}
      onChange={setPhase}
      className="shadow-md [&_[role=tablist]]:border-[var(--border)]/80 [&_[role=tablist]]:bg-[var(--surface-raised)]/92 [&_[role=tablist]]:backdrop-blur-md"
    />
  ) : null;

  if (!simulationOn && !trailing) return null;

  if (variant === "float") {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-2 z-[2147483000] flex justify-end px-2 sm:top-3 sm:px-3",
          className,
        )}
        title={simulationOn ? bundle.blurb : undefined}
      >
        <div className="pointer-events-auto relative flex items-center gap-2 sm:gap-3">
          {switcher}
          {trailing}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative z-30 flex shrink-0 items-center justify-end gap-2 border-b border-[var(--border)] bg-[var(--surface-panel)] px-2 py-2 sm:gap-3 sm:px-3",
        className,
      )}
      title={simulationOn ? bundle.blurb : undefined}
    >
      {switcher}
      {trailing}
    </div>
  );
}
