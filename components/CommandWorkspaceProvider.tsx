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
  subscribePendingAccounts,
  type PendingAccount,
} from "@/lib/auth/accountValidation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isOfficer } from "@/lib/auth/types";
import { subscribeAllReports } from "@/lib/reports/api";
import {
  reportInScope,
  scopeForProfile,
  type ReportScope,
} from "@/lib/reports/barangayScope";
import { ensureAllMapReportsInDb } from "@/lib/reports/seedMapReport";
import type { HazardReport } from "@/lib/reports/types";
import { subscribeSupportTickets } from "@/lib/support/api";
import type { SupportTicket } from "@/lib/support/api";
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
  supportTickets: SupportTicket[];
  pendingCitizenCount: number;
  pendingOfficerCount: number;
  reportQueueCount: number;
  supportOpenCount: number;
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
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
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
    void (async () => {
      try {
        await ensureAllMapReportsInDb();
      } catch (err) {
        console.warn("Map report seed failed", err);
      } finally {
        if (!cancelled) setSeedReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    if (!canSync) {
      setSupportTickets([]);
      return;
    }
    return subscribeSupportTickets(setSupportTickets);
  }, [canSync]);

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

  const scopedReports = useMemo(
    () => reports.filter((r) => reportInScope(r, reportScope)),
    [reports, reportScope],
  );

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
    const supportOpenCount = supportTickets.filter(
      (r) => r.status === "open" || r.status === "in_progress",
    ).length;

    return {
      reportScope,
      reports,
      scopedReports,
      pendingAccounts,
      supportTickets,
      pendingCitizenCount,
      pendingOfficerCount,
      reportQueueCount,
      supportOpenCount,
      weatherOk,
      weatherHazard,
      seedReady,
    };
  }, [
    reportScope,
    reports,
    scopedReports,
    pendingAccounts,
    supportTickets,
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
