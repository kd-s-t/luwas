"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isSimulationOn } from "@/lib/config/simulation";
import {
  getCat5Scenario,
  remapScenarioHouseholdIds,
} from "@/lib/scenarios/cat5Typhoon";
import {
  SCENARIO_PHASES,
  liveOpsScenarioBundle,
  type DrrmScenarioPhase,
  type ScenarioBundle,
} from "@/lib/scenarios/types";

const STORAGE_KEY = "luwas.drrm.scenario.phase";

type ScenarioContextValue = {
  phase: DrrmScenarioPhase;
  setPhase: (phase: DrrmScenarioPhase) => void;
  bundle: ScenarioBundle;
  officerBundle: ScenarioBundle;
  /** Tino Before/During/After + demo packs enabled. */
  simulationOn: boolean;
};

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

function isPhase(value: unknown): value is DrrmScenarioPhase {
  return (
    typeof value === "string" &&
    (SCENARIO_PHASES as string[]).includes(value)
  );
}

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const simulationOn = isSimulationOn();
  const [phase, setPhaseState] = useState<DrrmScenarioPhase>("during");

  useEffect(() => {
    if (!simulationOn) {
      setPhaseState("during");
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isPhase(stored)) setPhaseState(stored);
    } catch {
      /* ignore */
    }
  }, [simulationOn]);

  const setPhase = useCallback(
    (next: DrrmScenarioPhase) => {
      if (!simulationOn) return;
      setPhaseState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    },
    [simulationOn],
  );

  const bundle = useMemo(
    () =>
      simulationOn ? getCat5Scenario(phase) : liveOpsScenarioBundle(phase),
    [phase, simulationOn],
  );
  const officerBundle = useMemo(
    () =>
      simulationOn
        ? remapScenarioHouseholdIds(bundle, (i) => `seed-${i}`)
        : bundle,
    [bundle, simulationOn],
  );

  const value = useMemo(
    () => ({ phase, setPhase, bundle, officerBundle, simulationOn }),
    [phase, setPhase, bundle, officerBundle, simulationOn],
  );

  return (
    <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>
  );
}

export function useScenario(): ScenarioContextValue {
  const ctx = useContext(ScenarioContext);
  if (!ctx) {
    throw new Error("useScenario must be used within ScenarioProvider");
  }
  return ctx;
}
