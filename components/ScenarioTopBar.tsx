"use client";

import { usePathname } from "next/navigation";
import { ScenarioSwitcher } from "@/components/ScenarioSwitcher";
import { CAT5_SCENARIOS } from "@/lib/scenarios";
import { useScenario } from "@/lib/scenarios/ScenarioProvider";

/**
 * Odette Before / During / After — homepage + command center only.
 * Stay mounted from app/layout.tsx; visibility is pathname-gated here.
 */
export function ScenarioTopBar() {
  const pathname = usePathname();
  const { phase, setPhase } = useScenario();
  const bundle = CAT5_SCENARIOS[phase];

  const showOdette =
    pathname === "/" ||
    pathname === "/command" ||
    pathname === "/command/full";
  if (!showOdette) {
    return null;
  }

  return (
    <div className="relative z-50 border-b border-[var(--border)] bg-[var(--surface-panel)]">
      <div className="flex h-9 items-center justify-between gap-3 px-3 sm:px-6">
        <p
          className="min-w-0 truncate font-mono text-[10px] tracking-[0.14em] text-[var(--muted)] uppercase"
          title={bundle.blurb}
        >
          <span className="text-[var(--accent)]">Odette</span>
          <span className="mx-1.5 text-[var(--border)]">·</span>
          <span className="text-[var(--foreground)]">{bundle.shortLabel}</span>
          <span className="mx-1.5 hidden text-[var(--border)] sm:inline">·</span>
          <span className="hidden normal-case tracking-normal text-[var(--muted)] sm:inline">
            {bundle.label}
          </span>
        </p>
        <ScenarioSwitcher phase={phase} onChange={setPhase} />
      </div>
    </div>
  );
}
