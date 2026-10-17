import { isOfficer, type UserProfile } from "@/lib/auth/types";
import { distKm } from "@/lib/geo/bearing";
import { CEBU_AREA, isNearOpsArea, type LatLng } from "@/lib/geo/cebu";
import {
  DEFAULT_MAP_AREA,
  listMapAreaOptions,
  nearestKnownMapArea,
} from "@/lib/geo/mapAreas";
import type { HazardReport } from "@/lib/reports/types";

export const DEFAULT_REPORT_BARANGAY = "Nangka";
export const DEFAULT_REPORT_LGU = "Consolacion";

export type ReportScope =
  | { mode: "barangay"; barangay: string; lgu: string }
  | { mode: "lgu"; lgu: string };

/** Place from GPS via nearest curated hall (Apas, Nangka, …). */
export function placeFromCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
  maxKm = 3,
): { barangay: string; lgu: string } | null {
  if (lat == null || lng == null) return null;
  const near = nearestKnownMapArea(lat, lng, maxKm);
  if (!near) return null;
  return { barangay: near.barangay, lgu: near.lgu };
}

/** Resolve barangay/LGU: GPS nearest hall wins, then stored fields, then Nangka. */
export function resolveReportPlace(report: Pick<
  HazardReport,
  "barangay" | "lgu" | "lat" | "lng" | "citizenPurok"
>): { barangay: string; lgu: string } {
  const fromGps = placeFromCoords(report.lat, report.lng);
  if (fromGps) return fromGps;

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

/** Org suffix that is a title, not an LGU name. */
function isOrgTitleNotLgu(value: string): boolean {
  return /^(punong|captain|kagawad|secretary|treasurer|mdrrmo|drrm|focal|officer)\b/i.test(
    value.trim(),
  );
}

export function officerReportScope(
  orgName: string,
  profileLgu?: string | null,
): ReportScope {
  const raw = orgName.trim();
  const brgy = raw.match(
    /\b(?:brgy\.?|barangay)\s+([A-Za-z0-9][\w\s'-]*?)(?:\s*[·|,]|\s+MDRRMO|\s+DRRM|\s*$)/i,
  );
  if (brgy?.[1]) {
    const fromOrg = raw.split(/[·|,]/)[1]?.trim() || "";
    const fromOrgLgu =
      fromOrg && !/^mdrrmo/i.test(fromOrg) && !isOrgTitleNotLgu(fromOrg)
        ? fromOrg
        : "";
    const lgu =
      profileLgu?.trim() || fromOrgLgu || DEFAULT_REPORT_LGU;
    return {
      mode: "barangay",
      barangay: brgy[1].trim(),
      lgu,
    };
  }
  const lgu = raw.match(/^([A-Za-z][\w\s'-]+?)\s+MDRRMO\b/i);
  if (lgu?.[1]) {
    return { mode: "lgu", lgu: lgu[1].trim() };
  }
  return {
    mode: "barangay",
    barangay: DEFAULT_REPORT_BARANGAY,
    lgu: profileLgu?.trim() || DEFAULT_REPORT_LGU,
  };
}

export function scopeForProfile(profile: UserProfile | null): ReportScope {
  if (isOfficer(profile)) {
    // Prefer active / area id so a switch to Apas is not stuck on a stale
    // barangay field (e.g. still "Nangka" after selecting cebu-city/apas).
    const areaKey =
      profile.activeBarangayId?.trim() || profile.areaId?.trim() || "";
    if (areaKey) {
      const option = listMapAreaOptions().find((o) => o.id === areaKey);
      if (option) {
        return {
          mode: "barangay",
          barangay: option.barangay,
          lgu: option.lgu,
        };
      }
    }
    if (
      /apas/i.test(profile.orgName ?? "") ||
      /apas/i.test(profile.barangay ?? "")
    ) {
      return { mode: "barangay", barangay: "Apas", lgu: "Cebu City" };
    }
    const barangay = profile.barangay?.trim();
    const lgu = profile.lgu?.trim();
    if (barangay && lgu) {
      return { mode: "barangay", barangay, lgu };
    }
    return officerReportScope(profile.orgName, profile.lgu);
  }
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
