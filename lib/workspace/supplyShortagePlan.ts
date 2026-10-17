import type { HazardReport } from "@/lib/reports/types";
import {
  deskStockForReports,
  placeLine,
} from "@/lib/workspace/attentionBoard";
import {
  aggregateSupplyNeed,
  parseReportNeed,
  supplyNeedEpicCode,
  supplyNeedKind,
  supplyNeedNoun,
  type SupplyNeedKind,
} from "@/lib/workspace/reportNeed";

export type DeliveryReadiness = "ready" | "access_unknown" | "no_transport";

export type SupplyCommunityRow = {
  reportId: string;
  community: string;
  mediaUrl: string | null;
  peopleLabel: string;
  needL: number;
  localStockL: number;
  gapL: number;
  readiness: DeliveryReadiness;
  readinessLabel: string;
  lat: number | null;
  lng: number | null;
};

export type SupplyShortagePlan = {
  code: string;
  kind: SupplyNeedKind;
  resourceLabel: string;
  resourceBlurb: string;
  totalNeededL: number;
  availableL: number;
  shortageL: number;
  communityCount: number;
  rows: SupplyCommunityRow[];
  advisory: string;
  compareHref: string;
  primaryReportId: string;
};

function parseWaterL(report: HazardReport): number {
  const blob = `${report.title ?? ""}\n${report.notes ?? ""}`;
  const need =
    blob.match(
      /need(?:s|ing)?\s+(\d+)\s*L(?:\s+(?:of\s+)?(?:drinking\s+)?water)?/i,
    ) ??
    blob.match(/(\d+)\s*L\s+(?:of\s+)?(?:drinking\s+)?water/i) ??
    blob.match(/(\d+)\s*L/i);
  return need ? Number(need[1]) || 0 : 0;
}

function localStockL(report: HazardReport): number {
  const blob = `${report.title ?? ""}\n${report.notes ?? ""}`;
  const lower = blob.toLowerCase();
  if (
    /local stock empty|stock empty|no local stock|0\s*L\s+local/.test(lower)
  ) {
    return 0;
  }
  const m =
    blob.match(/(\d+)\s*L\s+local\s+stock/i) ??
    blob.match(/(\d+)\s*L\s+local\b/i) ??
    blob.match(/local stock[^\d]*(\d+)\s*L/i);
  if (m) return Number(m[1]) || 0;
  return 0;
}

function peopleLabel(report: HazardReport): string {
  const parsed = parseReportNeed(report);
  const m = parsed.householdsLabel.match(/Households\s+(\d+)/i);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return String(n * 4);
  }
  const blob = `${report.title ?? ""}\n${report.notes ?? ""}`;
  const people = blob.match(/(\d+)\s+(?:people|persons|residents)/i)?.[1];
  if (people) return people;
  return "—";
}

function readiness(report: HazardReport): {
  readiness: DeliveryReadiness;
  readinessLabel: string;
} {
  const blob = `${report.title ?? ""}\n${report.notes ?? ""}`.toLowerCase();
  if (
    /no transport|no vehicle|impassable|road blocked|cannot access|cut off/.test(
      blob,
    )
  ) {
    return { readiness: "no_transport", readinessLabel: "No transport" };
  }
  if (
    /access unknown|pending ground check|access unclear|access road unclear/.test(
      blob,
    ) ||
    report.lat == null ||
    report.lng == null ||
    (report.locationAccuracyM != null && report.locationAccuracyM > 80)
  ) {
    return { readiness: "access_unknown", readinessLabel: "Access unknown" };
  }
  return { readiness: "ready", readinessLabel: "Ready" };
}

function resourceBlurb(kind: SupplyNeedKind): string {
  switch (kind) {
    case "water":
      return "Essential for drinking, cooking, and hygiene needs.";
    case "food":
      return "Food packs for stranded and displaced households.";
    case "medical":
      return "First-aid and medical kits for field response.";
    case "relief":
      return "Mixed relief supplies across open shortage reports.";
  }
}

/** Build the Resources shortage plan desk from shared supply reports. */
export function buildSupplyShortagePlan(
  kind: SupplyNeedKind,
  reports: HazardReport[],
): SupplyShortagePlan | null {
  if (reports.length === 0) return null;

  const sorted = [...reports].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const stock = deskStockForReports(sorted);
  const agg = aggregateSupplyNeed(sorted);
  const availableL =
    kind === "water"
      ? Math.max(0, stock.waterL ?? 0)
      : kind === "food"
        ? Math.max(0, stock.foodPacks ?? 0)
        : kind === "medical"
          ? Math.max(0, stock.medicalKits ?? 0)
          : Math.max(0, (stock.waterL ?? 0) + (stock.foodPacks ?? 0));

  const totalNeededL =
    kind === "water"
      ? agg.waterL
      : kind === "food"
        ? agg.packs
        : kind === "medical"
          ? agg.kits
          : agg.waterL + agg.packs + agg.kits;

  const rows: SupplyCommunityRow[] = sorted.map((report) => {
    const need =
      kind === "water"
        ? parseWaterL(report)
        : kind === "food"
          ? Number(
              `${report.title}\n${report.notes}`.match(
                /(\d+)\s+food\s+packs?/i,
              )?.[1] ?? 0,
            )
          : kind === "medical"
            ? Number(
                `${report.title}\n${report.notes}`.match(
                  /(\d+)\s+(?:medical\s+)?kits?/i,
                )?.[1] ?? 0,
              )
            : parseWaterL(report);
    const local = kind === "water" ? localStockL(report) : 0;
    const gap = Math.max(0, need - local);
    const ready = readiness(report);
    return {
      reportId: report.id,
      community: placeLine(report),
      mediaUrl: report.mediaUrl?.trim() || null,
      peopleLabel: peopleLabel(report),
      needL: need,
      localStockL: local,
      gapL: gap,
      readiness: ready.readiness,
      readinessLabel: ready.readinessLabel,
      lat: report.lat,
      lng: report.lng,
    };
  });

  const shortageL = Math.max(0, totalNeededL - availableL);
  const primary = sorted[0]!;
  const noun = supplyNeedNoun(kind).toLowerCase();
  const communityWord =
    rows.length === 1 ? "community needs" : "communities need";

  return {
    code: supplyNeedEpicCode(kind),
    kind,
    resourceLabel: supplyNeedNoun(kind),
    resourceBlurb: resourceBlurb(kind),
    totalNeededL,
    availableL,
    shortageL,
    communityCount: rows.length,
    rows,
    advisory: `${rows.length} ${communityWord} more ${noun} than the warehouse can supply. Confirm local stock and review distribution options.`,
    compareHref: `/admin/resources/assist?report=${encodeURIComponent(primary.id)}`,
    primaryReportId: primary.id,
  };
}

/** Resolve shared shortage reports for an epic code (e.g. RS-001). */
export function reportsForEpicCode(
  code: string,
  reports: HazardReport[],
): { kind: SupplyNeedKind; reports: HazardReport[] } | null {
  const open = reports.filter(
    (r) => r.status !== "rejected" && r.status !== "done",
  );
  const buckets = new Map<SupplyNeedKind, HazardReport[]>();
  for (const report of open) {
    const kind = supplyNeedKind(report);
    if (!kind) continue;
    const list = buckets.get(kind) ?? [];
    list.push(report);
    buckets.set(kind, list);
  }
  for (const [kind, rows] of buckets) {
    if (supplyNeedEpicCode(kind) === code.toUpperCase() && rows.length > 0) {
      return { kind, reports: rows };
    }
  }
  return null;
}
