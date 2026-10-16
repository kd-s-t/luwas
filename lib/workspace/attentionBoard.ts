import type { HazardReport } from "@/lib/reports/types";
import { hazardHintLabel } from "@/lib/reports/types";
import { unknownsForReport } from "@/lib/workspace/incidentDerived";
import { parseReportNeed } from "@/lib/workspace/reportNeed";

export type AttentionKind = "critical" | "resource" | "approval";

export type AttentionTag = {
  label: string;
  tone: "critical" | "warn" | "info" | "muted";
};

export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  reportId: string;
  incidentCode: string;
  tags: AttentionTag[];
  headline: string;
  detail: string;
  timeLabel: string;
  meta: string;
  ctaLabel: string;
  ctaHref: string;
  primaryCta: boolean;
  lat: number | null;
  lng: number | null;
};

export type AttentionSummary = {
  urgent: number;
  shortages: number;
  approvals: number;
  items: AttentionItem[];
};

const QUEUE = new Set(["queued", "validating", "needs_review", "failed"]);
const URGENT_HAZARDS = new Set(["flood", "landslide", "fire", "typhoon"]);

function incidentCode(report: HazardReport, index: number): string {
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

/** Tighten "10:10 AM PHT" style labels. */
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

function placeLine(report: HazardReport): string {
  const purok = report.citizenPurok?.trim();
  if (purok) return purok;
  if (report.locationLabel?.trim()) return report.locationLabel.trim();
  return report.barangay || "Field";
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
  const medicalOffer = /medical|kit|red cross|rc-?\d/i.test(
    `${report.title ?? ""} ${report.notes ?? ""}`,
  );

  if (
    report.status === "needs_review" ||
    report.status === "failed" ||
    (inQueue && urgentHazard && unverified)
  ) {
    return "critical";
  }
  // Medical / partner offers stay on approval. Other stock gaps are shortages
  // so Resources shows Find assistance cards.
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

function buildItem(
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
    return {
      id: `resource-${report.id}`,
      kind,
      reportId: report.id,
      incidentCode: code,
      tags: [{ label: "Resource shortage", tone: "warn" }],
      headline: report.title || `${place} needs additional support.`,
      detail: short.detail,
      timeLabel: timeLabelPht(report.createdAt),
      meta: short.neededLabel,
      ctaLabel: "Find assistance",
      ctaHref: `/admin/resources/assist?report=${encodeURIComponent(report.id)}`,
      primaryCta: false,
      lat: report.lat,
      lng: report.lng,
    };
  }

  return {
    id: `approval-${report.id}`,
    kind: "approval",
    reportId: report.id,
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

const KIND_ORDER: Record<AttentionKind, number> = {
  critical: 0,
  resource: 1,
  approval: 2,
};

/** Build the overview attention board from scoped field reports. */
export function buildAttentionBoard(reports: HazardReport[]): AttentionSummary {
  const classified = reports
    .map((report) => ({ report, kind: classify(report) }))
    .filter((row): row is { report: HazardReport; kind: AttentionKind } =>
      Boolean(row.kind),
    )
    .sort((a, b) => {
      const ko = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
      if (ko !== 0) return ko;
      return Date.parse(b.report.createdAt) - Date.parse(a.report.createdAt);
    });

  const items = classified.map((row, i) =>
    buildItem(row.report, row.kind, i),
  );

  return {
    urgent: items.filter((i) => i.kind === "critical").length,
    shortages: items.filter((i) => i.kind === "resource").length,
    approvals: items.filter((i) => i.kind === "approval").length,
    items,
  };
}
