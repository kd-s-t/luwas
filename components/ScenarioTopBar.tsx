"use client";

import { ScenarioSwitcher } from "@/components/ScenarioSwitcher";
import { CAT5_SCENARIOS } from "@/lib/scenarios";
import { useScenario } from "@/lib/scenarios/ScenarioProvider";

/**
 * Global Before / During / After — always visible above every page.
 * DO NOT REMOVE from app/layout.tsx (user-critical; removed accidentally before).
 */
export function ScenarioTopBar() {
  const { phase, setPhase } = useScenario();
  const bundle = CAT5_SCENARIOS[phase];

  return (
    <div className="relative z-50 border-b border-[var(--border)] bg-[var(--surface-panel)]">
      <div className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="min-w-0">
          <p className="font-mono text-[9px] tracking-[0.22em] text-[var(--accent)] uppercase">
            Odette simulation · {bundle.label}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)] sm:line-clamp-1 sm:max-w-2xl">
            {bundle.blurb}
          </p>
        </div>
        <ScenarioSwitcher phase={phase} onChange={setPhase} />
      </div>
    </div>
  );
}
