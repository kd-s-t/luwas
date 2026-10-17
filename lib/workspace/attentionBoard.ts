import type { HazardReport } from "@/lib/reports/types";
import { hazardHintLabel } from "@/lib/reports/types";
import { unknownsForReport } from "@/lib/workspace/incidentDerived";
import {
  aggregateSupplyNeed,
  parseReportNeed,
  supplyNeedEpicCode,
  supplyNeedKind,
  supplyNeedNoun,
  supplyNeedUnit,
  type SupplyNeedKind,
} from "@/lib/workspace/reportNeed";

export type AttentionKind = "critical" | "resource" | "approval";

export type AttentionTag = {
  label: string;
  tone: "critical" | "warn" | "info" | "muted";
};

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  reportId: string;
  /** All field reports rolled into this shared shortage. */
  reportIds: string[];
  incidentCode: string;
  tags: AttentionTag[];
  headline: string;
  detail: string;
  /** Second detail line for shared shortages (Affects: …). */
  affectsLabel?: string | null;
  timeLabel: string;
  meta: string;
  ctaLabel: string;
  ctaHref: string;
  primaryCta: boolean;
  lat: number | null;
  lng: number | null;
};

export type AttentionGroup = {
  id: "shared" | "review" | "approvals";
  label: string;
  items: AttentionItem[];
};

export type AttentionStock = {
  waterL?: number;
  foodPacks?: number;
  medicalKits?: number;
};

export type AttentionSummary = {
  urgent: number;
  shortages: number;
  approvals: number;
  communities: number;
  items: AttentionItem[];
  groups: AttentionGroup[];
};

const QUEUE = new Set(["queued", "validating", "needs_review", "failed"]);
const URGENT_HAZARDS = new Set(["flood", "landslide", "fire", "typhoon"]);

const KIND_ORDER: Record<AttentionKind, number> = {
  critical: 0,
  resource: 1,
  approval: 2,
};

function incidentCode(report: HazardReport, index: number): string {
  if (/^REQ-/i.test(report.id)) return report.id.toUpperCase();
  if (/^RS-/i.test(report.id)) return report.id.toUpperCase();
  const tail = report.id.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase();
  if (tail.length >= 2) return `INC-${tail}`;
  return `INC-${String(40 + index).padStart(3, "0")}`;
}

function formatPht(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    })
      .format(new Date(iso))
      .replace(/\s/g, " ")
      .toUpperCase()
      .replace("AM", "AM PHT")
      .replace("PM", "PM PHT")
      .replace(" AM PHT", " AM PHT")
      .replace(" PM PHT", " PM PHT");
  } catch {
    return "—";
  }
}

function timeLabelPht(iso: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    }).formatToParts(new Date(iso));
    const hour = parts.find((p) => p.type === "hour")?.value ?? "";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "";
    const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
    return `${hour}:${minute} ${dayPeriod.toUpperCase()} PHT`;
  } catch {
    return formatPht(iso);
  }
}

export function placeLine(report: HazardReport): string {
  const purok = report.citizenPurok?.trim();
  if (purok) return purok;
  if (report.locationLabel?.trim()) return report.locationLabel.trim();
  return report.barangay || "Field";
}

/** Desk stock for shortage math (Apas seed amounts when scoped there). */
export function deskStockForReports(
  reports: { barangay?: string | null }[],
): AttentionStock {
  const apas = reports.some((r) => /apas/i.test(r.barangay ?? ""));
  if (apas) {
    return { waterL: 1200, foodPacks: 160, medicalKits: 10 };
  }
  // Nangka / Consolacion demo warehouse (multi-purok water desk).
  return { waterL: 1200, foodPacks: 160, medicalKits: 10 };
}

/** Shared shortage copy: headline · qty line · Affects (related text only). */
export function epicShortageCopy(
  kind: SupplyNeedKind,
  reports: HazardReport[],
  stock?: AttentionStock,
): {
  incidentCode: string;
  headline: string;
  detail: string;
  affectsLabel: string;
  meta: string;
  primary: HazardReport;
  reportIds: string[];
} {
  const sorted = [...reports].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const primary = sorted[0]!;
  const places = [...new Set(sorted.map(placeLine).filter(Boolean))];
  const placeLabel = places.join(", ");
  const agg = aggregateSupplyNeed(sorted);
  const requested = requestedFor(kind, agg);
  const available = stockAvailable(kind, stock);
  const shortage = Math.max(0, requested - available);
  const unit = supplyNeedUnit(kind);
  const communityWord =
    places.length === 1 ? "community" : "communities";
  const requestWord = sorted.length === 1 ? "request" : "requests";

  return {
    incidentCode: supplyNeedEpicCode(kind),
    headline: `${supplyNeedNoun(kind)} shortage across ${places.length} ${communityWord}`,
    detail: `${fmtQty(requested)} ${unit} requested · ${fmtQty(available)} ${unit} available · ${fmtQty(shortage)} ${unit} shortage`,
    affectsLabel: `Affects: ${placeLabel}`,
    meta: `${sorted.length} ${requestWord}`,
    primary,
    reportIds: sorted.map((r) => r.id),
  };
}

function isUnverified(report: HazardReport): boolean {
  if (report.status === "needs_review" || report.status === "failed") return true;
  if (report.aiVerdict === "needs_review") return true;
  if (report.aiConfidence != null && report.aiConfidence < 0.55) return true;
  if ((report.trustScore ?? 100) < 50) return true;
  return unknownsForReport(report).some((u) =>
    ["location", "accuracy", "review", "confidence"].includes(u.id),
  );
}

function classify(report: HazardReport): AttentionKind | null {
  if (report.status === "rejected") return null;

  const need = parseReportNeed(report);
  const short = { short: need.short, detail: need.detail };
  const awaitingPlan =
    report.status === "legit" && !report.autoResponderCallAt;
  const inQueue = QUEUE.has(report.status);
  const urgentHazard = URGENT_HAZARDS.has(report.hazardHint);
  const unverified = isUnverified(report);
  const supplyKind = supplyNeedKind(report);
  const medicalOffer =
    !supplyKind &&
    /medical|kit|red cross|rc-?\d/i.test(
      `${report.title ?? ""} ${report.notes ?? ""}`,
    );

  if (supplyKind && (inQueue || report.status === "legit" || awaitingPlan)) {
    return "resource";
  }

  if (
    report.status === "needs_review" ||
    report.status === "failed" ||
    (inQueue && urgentHazard && unverified)
  ) {
    return "critical";
  }
  if (medicalOffer && (awaitingPlan || report.status === "legit")) {
    return "approval";
  }
  if (short.short && (inQueue || report.status === "legit" || awaitingPlan)) {
    return "resource";
  }
  if (awaitingPlan) {
    return "approval";
  }
  if (inQueue && report.aiVerdict === "legit") {
    return "approval";
  }
  if (inQueue && urgentHazard) return "critical";
  if (inQueue) return "approval";
  return null;
}

function fmtQty(n: number): string {
  return n.toLocaleString("en-PH");
}

function stockAvailable(kind: SupplyNeedKind, stock?: AttentionStock): number {
  if (kind === "water") return Math.max(0, stock?.waterL ?? 0);
  if (kind === "food") return Math.max(0, stock?.foodPacks ?? 0);
  if (kind === "medical") return Math.max(0, stock?.medicalKits ?? 0);
  const water = Math.max(0, stock?.waterL ?? 0);
  const food = Math.max(0, stock?.foodPacks ?? 0);
  const kits = Math.max(0, stock?.medicalKits ?? 0);
  return water + food + kits;
}

function requestedFor(kind: SupplyNeedKind, agg: ReturnType<typeof aggregateSupplyNeed>): number {
  if (kind === "water") return agg.waterL;
  if (kind === "food") return agg.packs;
  if (kind === "medical") return agg.kits;
  return agg.waterL + agg.packs + agg.kits;
}

function buildSoloItem(
  report: HazardReport,
  kind: AttentionKind,
  index: number,
): AttentionItem {
  const code = incidentCode(report, index);
  const place = placeLine(report);
  const unverified = isUnverified(report);
  const short = parseReportNeed(report);
  const href = `/admin/incidents/${encodeURIComponent(report.id)}`;

  if (kind === "critical") {
    const tags: AttentionTag[] = [
      { label: "Critical", tone: "critical" },
    ];
    if (unverified) tags.push({ label: "Unverified", tone: "warn" });
    return {
      id: `critical-${report.id}`,
      kind,
      reportId: report.id,
      reportIds: [report.id],
      incidentCode: code,
      tags,
      headline: report.title || hazardHintLabel(report.hazardHint),
      detail: `${place} · ${
        report.notes?.trim() ||
        "Reports need verification. No authorized response assigned yet."
      }`,
      timeLabel: timeLabelPht(report.createdAt),
      meta: "Needs review",
      ctaLabel: "Review incident",
      ctaHref: href,
      primaryCta: true,
      lat: report.lat,
      lng: report.lng,
    };
  }

  if (kind === "resource") {
    const supply = supplyNeedKind(report);
    const shortageHref = supply
      ? `/admin/resources/${encodeURIComponent(supplyNeedEpicCode(supply))}`
      : `/admin/resources/assist?report=${encodeURIComponent(report.id)}`;
    return {
      id: `resource-${report.id}`,
      kind,
      reportId: report.id,
      reportIds: [report.id],
      incidentCode: supply ? supplyNeedEpicCode(supply) : code,
      tags: [{ label: "Resource shortage", tone: "warn" }],
      headline: report.title || `${place} needs additional support.`,
      detail: short.detail,
      timeLabel: timeLabelPht(report.createdAt),
      meta: "1 request",
      ctaLabel: "Review shortage",
      ctaHref: shortageHref,
      primaryCta: false,
      lat: report.lat,
      lng: report.lng,
    };
  }

  return {
    id: `approval-${report.id}`,
    kind: "approval",
    reportId: report.id,
    reportIds: [report.id],
    incidentCode: code,
    tags: [{ label: "Approval needed", tone: "info" }],
    headline: report.title || "Commitment awaiting approval.",
    detail: short.detail || "Partner or plan proposal awaiting human approval.",
    timeLabel: timeLabelPht(report.updatedAt || report.createdAt),
    meta: short.neededLabel,
    ctaLabel: "Review plan",
    ctaHref: href,
    primaryCta: false,
    lat: report.lat,
    lng: report.lng,
  };
}

function buildEpicItem(
  kind: SupplyNeedKind,
  reports: HazardReport[],
  stock?: AttentionStock,
): AttentionItem {
  const copy = epicShortageCopy(kind, reports, stock);
  return {
    id: `epic-${kind}`,
    kind: "resource",
    reportId: copy.primary.id,
    reportIds: copy.reportIds,
    incidentCode: copy.incidentCode,
    tags: [{ label: "Shared resource shortage", tone: "warn" }],
    headline: copy.headline,
    detail: copy.detail,
    affectsLabel: copy.affectsLabel,
    timeLabel: timeLabelPht(copy.primary.createdAt),
    meta: copy.meta,
    ctaLabel: "Review shortage",
    ctaHref: `/admin/resources/${encodeURIComponent(copy.incidentCode)}`,
    primaryCta: false,
    lat: copy.primary.lat,
    lng: copy.primary.lng,
  };
}

/** Build the overview attention board from scoped field reports. */
export function buildAttentionBoard(
  reports: HazardReport[],
  stock?: AttentionStock,
): AttentionSummary {
  const classified = reports
    .map((report) => ({ report, kind: classify(report) }))
    .filter((row): row is { report: HazardReport; kind: AttentionKind } =>
      Boolean(row.kind),
    )
    .sort(
      (a, b) => Date.parse(b.report.createdAt) - Date.parse(a.report.createdAt),
    );

  const epicBuckets = new Map<
    SupplyNeedKind,
    { report: HazardReport; kind: AttentionKind }[]
  >();
  const solo: { report: HazardReport; kind: AttentionKind }[] = [];

  for (const row of classified) {
    const supply = supplyNeedKind(row.report);
    if (supply && (row.kind === "resource" || row.kind === "critical")) {
      const bucket = epicBuckets.get(supply) ?? [];
      bucket.push(row);
      epicBuckets.set(supply, bucket);
      continue;
    }
    solo.push(row);
  }

  const shared: AttentionItem[] = [];
  for (const [supply, rows] of epicBuckets) {
    shared.push(
      buildEpicItem(
        supply,
        rows.map((r) => r.report),
        stock,
      ),
    );
  }

  const review: AttentionItem[] = [];
  const approvals: AttentionItem[] = [];
  for (const [i, row] of solo.entries()) {
    const item = buildSoloItem(row.report, row.kind, i);
    if (row.kind === "approval") approvals.push(item);
    else if (row.kind === "resource") shared.push(item);
    else review.push(item);
  }

  // Design order: critical → shared shortage → approvals (flat list).
  const items = [...review, ...shared, ...approvals].sort((a, b) => {
    const ko = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (ko !== 0) return ko;
    if (a.kind === "resource" && b.kind === "resource") {
      return b.reportIds.length - a.reportIds.length;
    }
    return 0;
  });

  const groups = (
    [
      { id: "review", label: "Needs review", items: review },
      { id: "shared", label: "Shared needs", items: shared },
      { id: "approvals", label: "Approvals", items: approvals },
    ] satisfies AttentionGroup[]
  ).filter((g) => g.items.length > 0);

  const communities = new Set(
    reports
      .filter((r) => r.status !== "rejected")
      .map(placeLine)
      .filter(Boolean),
  ).size;

  return {
    urgent: review.length,
    shortages: shared.length,
    approvals: approvals.length,
    communities,
    items,
    groups,
  };
}
