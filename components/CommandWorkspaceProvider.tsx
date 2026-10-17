"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  officerScopeBarangay,
  subscribeBarangayUsers,
  subscribePendingAccounts,
  type PendingAccount,
} from "@/lib/auth/accountValidation";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isAccountActive,
  isOfficer,
  type OfficerProfile,
  type UserProfile,
} from "@/lib/auth/types";
import { subscribeAllReports } from "@/lib/reports/api";
import {
  reportInScope,
  scopeForProfile,
  type ReportScope,
} from "@/lib/reports/barangayScope";
import {
  hideScenarioDemoReportsInUi,
  isTinoScenarioDemoReport,
} from "@/lib/reports/scenarioDemo";
import { ensureAllMapReportsInDb } from "@/lib/reports/seedMapReport";
import type { HazardReport } from "@/lib/reports/types";
import { fetchCebuWeather, isHazardousWeather } from "@/lib/weather/openMeteo";

const QUEUE_STATUSES = new Set([
  "queued",
  "validating",
  "needs_review",
  "failed",
]);

type CommandWorkspaceValue = {
  reportScope: ReportScope;
  /** All reports (unscoped). Prefer scopedReports for UI. */
  reports: HazardReport[];
  scopedReports: HazardReport[];
  pendingAccounts: PendingAccount[];
  /** Active + pending users in this barangay (officers + citizens). */
  barangayUsers: UserProfile[];
  /** Active officers only, sorted by name (assign menus / workload). */
  activeOfficers: OfficerProfile[];
  pendingCitizenCount: number;
  pendingOfficerCount: number;
  reportQueueCount: number;
  weatherOk: boolean | null;
  weatherHazard: boolean;
  seedReady: boolean;
};

const CommandWorkspaceContext = createContext<CommandWorkspaceValue | null>(
  null,
);

/**
 * One shared Firestore + weather feed for CommandShell pages.
 * Avoids duplicate reports/pending listeners across shell, bell, and overview.
 */
export function CommandWorkspaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { profile } = useAuth();
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [pendingAccounts, setPendingAccounts] = useState<PendingAccount[]>(
    [],
  );
  const [barangayUsers, setBarangayUsers] = useState<UserProfile[]>([]);
  const [weatherOk, setWeatherOk] = useState<boolean | null>(null);
  const [weatherHazard, setWeatherHazard] = useState(false);
  const [seedReady, setSeedReady] = useState(false);

  const canSync = isOfficer(profile) && isAccountActive(profile);
  const barangay = canSync && profile ? officerScopeBarangay(profile) : "";
  const areaId =
    canSync && profile ? profile.areaId ?? profile.activeBarangayId : null;
  const reportScope = useMemo(() => scopeForProfile(profile), [profile]);

  useEffect(() => {
    let cancelled = false;
    // Mark ready quickly so Resources/Overview paint; seeds keep running in background.
    const readyDeadline = window.setTimeout(() => {
      if (!cancelled) setSeedReady(true);
    }, 1500);
    void (async () => {
      try {
        const { isSimulationOn } = await import("@/lib/config/simulation");
        const sim = isSimulationOn();
        // Apas water/fire first — Resources shortage desk needs these soonest.
        if (
          canSync &&
          profile &&
          isOfficer(profile) &&
          (profile.activeBarangayId === "cebu-city/apas" ||
            profile.areaId === "cebu-city/apas" ||
            /apas/i.test(profile.barangay ?? ""))
        ) {
          const { ensureApasOpsSeed } = await import(
            "@/lib/onboarding/apasSeed"
          );
          await ensureApasOpsSeed(profile.uid, {
            includeSampleReports: sim,
          });
          if (!cancelled) setSeedReady(true);
        }
        const apasOfficer =
          canSync &&
          profile &&
          isOfficer(profile) &&
          (profile.activeBarangayId === "cebu-city/apas" ||
            profile.areaId === "cebu-city/apas" ||
            /apas/i.test(profile.barangay ?? ""));
        await Promise.all([
          sim ? ensureAllMapReportsInDb() : Promise.resolve(),
          // Nangka queue / relief samples — skip on Apas desk (water sitios only).
          sim && !apasOfficer
            ? import("@/lib/reports/ensureQueueSampleReports").then(
                ({ ensureQueueSampleReports }) => ensureQueueSampleReports(),
              )
            : Promise.resolve(),
          sim && !apasOfficer
            ? import("@/lib/reports/ensureResourceShortageReport").then(
                ({ ensureResourceShortageReport }) =>
                  ensureResourceShortageReport(),
              )
            : Promise.resolve(),
        ]);
        if (canSync && profile && isOfficer(profile)) {
          const { ensureActiveBarangayInventory } = await import(
            "@/lib/inventory/api"
          );
          await ensureActiveBarangayInventory();
        }
      } catch (err) {
        console.warn("Command workspace seed failed", err);
      } finally {
        if (!cancelled) setSeedReady(true);
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(readyDeadline);
    };
  }, [canSync, profile]);

  useEffect(() => {
    if (!canSync) {
      setReports([]);
      return;
    }
    return subscribeAllReports(setReports);
  }, [canSync]);

  useEffect(() => {
    if (!canSync || !barangay) {
      setPendingAccounts([]);
      return;
    }
    return subscribePendingAccounts(
      barangay,
      setPendingAccounts,
      undefined,
      areaId,
    );
  }, [canSync, barangay, areaId]);

  useEffect(() => {
    if (!canSync || !barangay) {
      setBarangayUsers([]);
      return;
    }
    return subscribeBarangayUsers(
      barangay,
      setBarangayUsers,
      undefined,
      areaId,
    );
  }, [canSync, barangay, areaId]);

  useEffect(() => {
    let cancelled = false;
    void fetchCebuWeather()
      .then((w) => {
        if (cancelled) return;
        setWeatherOk(true);
        setWeatherHazard(
          isHazardousWeather(w.weatherCode, w.precipitationMm),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setWeatherOk(false);
          setWeatherHazard(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const scopedReports = useMemo(() => {
    const inScope = reports.filter((r) => reportInScope(r, reportScope));
    if (!hideScenarioDemoReportsInUi()) return inScope;
    return inScope.filter((r) => !isTinoScenarioDemoReport(r));
  }, [reports, reportScope]);

  const activeOfficers = useMemo(() => {
    const active = barangayUsers.filter(
      (u): u is OfficerProfile => isOfficer(u) && isAccountActive(u),
    );
    active.sort((a, b) =>
      (a.displayName || a.email).localeCompare(b.displayName || b.email),
    );
    return active;
  }, [barangayUsers]);

  const value = useMemo<CommandWorkspaceValue>(() => {
    const pendingCitizenCount = pendingAccounts.filter(
      (r) => r.role === "citizen",
    ).length;
    const pendingOfficerCount = pendingAccounts.filter(
      (r) => r.role === "officer",
    ).length;
    const reportQueueCount = scopedReports.filter((r) =>
      QUEUE_STATUSES.has(r.status),
    ).length;

    return {
      reportScope,
      reports,
      scopedReports,
      pendingAccounts,
      barangayUsers,
      activeOfficers,
      pendingCitizenCount,
      pendingOfficerCount,
      reportQueueCount,
      weatherOk,
      weatherHazard,
      seedReady,
    };
  }, [
    reportScope,
    reports,
    scopedReports,
    pendingAccounts,
    barangayUsers,
    activeOfficers,
    weatherOk,
    weatherHazard,
    seedReady,
  ]);

  return (
    <CommandWorkspaceContext.Provider value={value}>
      {children}
    </CommandWorkspaceContext.Provider>
  );
}

export function useCommandWorkspace(): CommandWorkspaceValue {
  const ctx = useContext(CommandWorkspaceContext);
  if (!ctx) {
    throw new Error(
      "useCommandWorkspace must be used inside CommandWorkspaceProvider",
    );
  }
  return ctx;
}
