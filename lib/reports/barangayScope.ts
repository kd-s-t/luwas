import { isOfficer, type UserProfile } from "@/lib/auth/types";
import { distKm } from "@/lib/geo/bearing";
import { CEBU_AREA, isNearOpsArea, type LatLng } from "@/lib/geo/cebu";
import { DEFAULT_MAP_AREA } from "@/lib/geo/mapAreas";
import type { HazardReport } from "@/lib/reports/types";

export const DEFAULT_REPORT_BARANGAY = "Nangka";
export const DEFAULT_REPORT_LGU = "Consolacion";

export type ReportScope =
  | { mode: "barangay"; barangay: string; lgu: string }
  | { mode: "lgu"; lgu: string };

/** Resolve barangay/LGU from stored fields or Nangka ops heuristics. */
export function resolveReportPlace(report: Pick<
  HazardReport,
  "barangay" | "lgu" | "lat" | "lng" | "citizenPurok"
>): { barangay: string; lgu: string } {
  const barangay = report.barangay?.trim();
  const lgu = report.lgu?.trim();
  if (barangay) {
    return {
      barangay,
      lgu: lgu || DEFAULT_REPORT_LGU,
    };
  }
  if (
    report.lat != null &&
    report.lng != null &&
    isNearOpsArea(report.lat, report.lng, 4)
  ) {
    return {
      barangay: DEFAULT_REPORT_BARANGAY,
      lgu: DEFAULT_REPORT_LGU,
    };
  }
  if (/^purok\b/i.test(report.citizenPurok ?? "")) {
    return {
      barangay: DEFAULT_REPORT_BARANGAY,
      lgu: DEFAULT_REPORT_LGU,
    };
  }
  return {
    barangay: barangay || "Unknown",
    lgu: lgu || "Unknown",
  };
}

/**
 * Officer org → which reports they see.
 * "Brgy. Nangka …" → Nangka only; "Consolacion MDRRMO" → whole LGU.
 */
export function officerReportScope(orgName: string): ReportScope {
  const raw = orgName.trim();
  const brgy = raw.match(
    /\b(?:brgy\.?|barangay)\s+([A-Za-z0-9][\w\s'-]*?)(?:\s*[·|,]|\s+MDRRMO|\s+DRRM|\s*$)/i,
  );
  if (brgy?.[1]) {
    return {
      mode: "barangay",
      barangay: brgy[1].trim(),
      lgu: DEFAULT_REPORT_LGU,
    };
  }
  const lgu = raw.match(/^([A-Za-z][\w\s'-]+?)\s+MDRRMO\b/i);
  if (lgu?.[1]) {
    return { mode: "lgu", lgu: lgu[1].trim() };
  }
  return {
    mode: "barangay",
    barangay: DEFAULT_REPORT_BARANGAY,
    lgu: DEFAULT_REPORT_LGU,
  };
}

export function scopeForProfile(profile: UserProfile | null): ReportScope {
  if (isOfficer(profile)) return officerReportScope(profile.orgName);
  return {
    mode: "barangay",
    barangay: DEFAULT_REPORT_BARANGAY,
    lgu: DEFAULT_REPORT_LGU,
  };
}

export function reportInScope(report: HazardReport, scope: ReportScope): boolean {
  const place = resolveReportPlace(report);
  if (scope.mode === "barangay") {
    return (
      place.barangay.toLowerCase() === scope.barangay.toLowerCase() &&
      place.lgu.toLowerCase() === scope.lgu.toLowerCase()
    );
  }
  return place.lgu.toLowerCase() === scope.lgu.toLowerCase();
}

export function scopeLabel(scope: ReportScope): string {
  if (scope.mode === "barangay") {
    return `Brgy. ${scope.barangay}, ${scope.lgu}`;
  }
  return `${scope.lgu} (all barangays)`;
}

/** Ops / officer fallback when GPS is off. */
export function scopeAnchor(scope: ReportScope): LatLng {
  if (
    scope.mode === "barangay" &&
    scope.barangay.toLowerCase() === DEFAULT_REPORT_BARANGAY.toLowerCase()
  ) {
    return { ...DEFAULT_MAP_AREA.center };
  }
  return { ...CEBU_AREA.center };
}

export function sortReportsByDistance(
  rows: HazardReport[],
  from: LatLng,
): { report: HazardReport; distanceKm: number | null }[] {
  return rows
    .map((report) => {
      if (report.lat == null || report.lng == null) {
        return { report, distanceKm: null as number | null };
      }
      return {
        report,
        distanceKm: distKm(from, { lat: report.lat, lng: report.lng }),
      };
    })
    .sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) {
        return Date.parse(b.report.createdAt) - Date.parse(a.report.createdAt);
      }
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return Date.parse(b.report.createdAt) - Date.parse(a.report.createdAt);
    });
}

export function formatDistanceKm(km: number | null): string {
  if (km == null) return "No GPS";
  if (km < 0.1) return "< 100 m";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}
