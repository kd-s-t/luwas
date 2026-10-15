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
  isTinoSimulationPhase,
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
  /** Env flag: Before/During/After available in the pill. */
  simulationOn: boolean;
  /** Tino drill packs active (not No storm / live today). */
  tinoActive: boolean;
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
  const [phase, setPhaseState] = useState<DrrmScenarioPhase>("nostorm");

  useEffect(() => {
    if (!simulationOn) {
      setPhaseState("nostorm");
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
      if (!simulationOn && next !== "nostorm") return;
      setPhaseState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
    },
    [simulationOn],
  );

  const tinoActive = simulationOn && isTinoSimulationPhase(phase);

  const bundle = useMemo(() => {
    if (!tinoActive) return liveOpsScenarioBundle("nostorm");
    return getCat5Scenario(phase);
  }, [phase, tinoActive]);

  const officerBundle = useMemo(
    () =>
      tinoActive
        ? remapScenarioHouseholdIds(bundle, (i) => `seed-${i}`)
        : bundle,
    [bundle, tinoActive],
  );

  const value = useMemo(
    () => ({
      phase,
      setPhase,
      bundle,
      officerBundle,
      simulationOn,
      tinoActive,
    }),
    [phase, setPhase, bundle, officerBundle, simulationOn, tinoActive],
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
