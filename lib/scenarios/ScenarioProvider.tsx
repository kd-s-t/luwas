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
import {
  getCat5Scenario,
  remapScenarioHouseholdIds,
} from "@/lib/scenarios/cat5Typhoon";
import {
  SCENARIO_PHASES,
  type DrrmScenarioPhase,
  type ScenarioBundle,
} from "@/lib/scenarios/types";

const STORAGE_KEY = "luwas.drrm.scenario.phase";

type ScenarioContextValue = {
  phase: DrrmScenarioPhase;
  setPhase: (phase: DrrmScenarioPhase) => void;
  bundle: ScenarioBundle;
  officerBundle: ScenarioBundle;
};

const ScenarioContext = createContext<ScenarioContextValue | null>(null);

function isPhase(value: unknown): value is DrrmScenarioPhase {
  return (
    typeof value === "string" &&
    (SCENARIO_PHASES as string[]).includes(value)
  );
}

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [phase, setPhaseState] = useState<DrrmScenarioPhase>("during");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (isPhase(stored)) setPhaseState(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const setPhase = useCallback((next: DrrmScenarioPhase) => {
    setPhaseState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const bundle = useMemo(() => getCat5Scenario(phase), [phase]);
  const officerBundle = useMemo(
    () => remapScenarioHouseholdIds(bundle, (i) => `seed-${i}`),
    [bundle],
  );

  const value = useMemo(
    () => ({ phase, setPhase, bundle, officerBundle }),
    [phase, setPhase, bundle, officerBundle],
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
