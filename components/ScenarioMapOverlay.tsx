"use client";

import { ScenarioSwitcher } from "@/components/ScenarioSwitcher";
import { CAT5_SCENARIOS } from "@/lib/scenarios";
import { useScenario } from "@/lib/scenarios/ScenarioProvider";
import { cn } from "@/lib/utils";

/**
 * Before / During / After — floats on the situation map (home + command).
 */
export function ScenarioMapOverlay({ className }: { className?: string }) {
  const { phase, setPhase } = useScenario();
  const bundle = CAT5_SCENARIOS[phase];

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 top-2 z-[1100] flex justify-center px-2 sm:top-3 sm:px-3",
        className,
      )}
    >
      <div
        className="pointer-events-auto flex max-w-full items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)]/92 px-2 py-1.5 shadow-md backdrop-blur-md sm:rounded-full sm:px-2.5 sm:py-1"
        title={bundle.blurb}
      >
        <p className="hidden min-w-0 truncate pl-1 font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase sm:block">
          <span className="text-[var(--accent)]">Tino</span>
          <span className="mx-1 text-[var(--border)]">·</span>
          <span className="text-[var(--foreground)]">{bundle.shortLabel}</span>
        </p>
        <ScenarioSwitcher phase={phase} onChange={setPhase} />
      </div>
    </div>
  );
}
