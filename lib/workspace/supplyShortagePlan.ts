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
  /** All report ids rolled into this sitio. */
  reportIds: string[];
  community: string;
  /** e.g. Brgy. Apas — shown under the sitio name. */
  barangayLabel: string;
  mediaUrl: string | null;
  peopleLabel: string;
  /** How many field requests were summed into this sitio. */
  requestCount: number;
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

function peopleCount(report: HazardReport): number {
  const parsed = parseReportNeed(report);
  const m = parsed.householdsLabel.match(/Households\s+(\d+)/i);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n * 4;
  }
  const blob = `${report.title ?? ""}\n${report.notes ?? ""}`;
  const people = blob.match(/(\d+)\s+(?:people|persons|residents)/i)?.[1];
  if (people) return Number(people) || 0;
  return 0;
}

function needAmount(kind: SupplyNeedKind, report: HazardReport): number {
  if (kind === "water") return parseWaterL(report);
  if (kind === "food") {
    return Number(
      `${report.title}\n${report.notes}`.match(/(\d+)\s+food\s+packs?/i)?.[1] ??
        0,
    );
  }
  if (kind === "medical") {
    return Number(
      `${report.title}\n${report.notes}`.match(
        /(\d+)\s+(?:medical\s+)?kits?/i,
      )?.[1] ?? 0,
    );
  }
  return parseWaterL(report);
}

const READINESS_RANK: Record<DeliveryReadiness, number> = {
  ready: 0,
  access_unknown: 1,
  no_transport: 2,
};

function readinessLabelFor(r: DeliveryReadiness): string {
  if (r === "no_transport") return "No transport";
  if (r === "access_unknown") return "Access unknown";
  return "Ready";
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

  // One row per sitio: sum need + people from every request that sitio filed.
  const bySitio = new Map<
    string,
    {
      reportIds: string[];
      community: string;
      barangayLabel: string;
      mediaUrl: string | null;
      people: number;
      needL: number;
      localStockL: number;
      readiness: DeliveryReadiness;
      lat: number | null;
      lng: number | null;
      latestAt: number;
    }
  >();

  for (const report of sorted) {
    const community = placeLine(report);
    const barangayLabel = report.barangay?.trim()
      ? `Brgy. ${report.barangay.trim()}`
      : "";
    const key = community.toLowerCase();
    const need = needAmount(kind, report);
    const local = kind === "water" ? localStockL(report) : 0;
    const ready = readiness(report).readiness;
    const at = Date.parse(report.createdAt) || 0;
    const prev = bySitio.get(key);
    if (!prev) {
      bySitio.set(key, {
        reportIds: [report.id],
        community,
        barangayLabel,
        mediaUrl: report.mediaUrl?.trim() || null,
        people: peopleCount(report),
        needL: need,
        localStockL: local,
        readiness: ready,
        lat: report.lat,
        lng: report.lng,
        latestAt: at,
      });
      continue;
    }
    prev.reportIds.push(report.id);
    prev.people += peopleCount(report);
    prev.needL += need;
    prev.localStockL += local;
    if (READINESS_RANK[ready] > READINESS_RANK[prev.readiness]) {
      prev.readiness = ready;
    }
    if (at >= prev.latestAt) {
      prev.latestAt = at;
      prev.mediaUrl = report.mediaUrl?.trim() || prev.mediaUrl;
      if (barangayLabel) prev.barangayLabel = barangayLabel;
      if (report.lat != null && report.lng != null) {
        prev.lat = report.lat;
        prev.lng = report.lng;
      }
    }
  }

  const rows: SupplyCommunityRow[] = [...bySitio.values()]
    .sort((a, b) => b.needL - a.needL)
    .map((row) => {
      const gap = Math.max(0, row.needL - row.localStockL);
      return {
        reportId: row.reportIds[0]!,
        reportIds: row.reportIds,
        community: row.community,
        barangayLabel: row.barangayLabel,
        mediaUrl: row.mediaUrl,
        peopleLabel: row.people > 0 ? String(row.people) : "—",
        requestCount: row.reportIds.length,
        needL: row.needL,
        localStockL: row.localStockL,
        gapL: gap,
        readiness: row.readiness,
        readinessLabel: readinessLabelFor(row.readiness),
        lat: row.lat,
        lng: row.lng,
      };
    });

  const shortageL = Math.max(0, totalNeededL - availableL);
  const primary = sorted[0]!;
  const noun =
    kind === "water" ? "water" : supplyNeedNoun(kind).toLowerCase();
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
    advisory: `${rows.length === 1 ? "One" : rows.length === 2 ? "Two" : rows.length === 3 ? "Three" : String(rows.length)} ${communityWord} more ${noun} than the warehouse can supply. Confirm local stock and review distribution options.`,
    compareHref: `/admin/resources/compare/${encodeURIComponent(supplyNeedEpicCode(kind))}`,
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
