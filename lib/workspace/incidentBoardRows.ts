import type { HazardReport, ReportStatus } from "@/lib/reports/types";
import { hazardHintLabel } from "@/lib/reports/types";
import { relatedReports } from "@/lib/workspace/incidentDerived";

export type BoardUrgency = "critical" | "high" | "moderate";
export type BoardSection = "operational" | "intake";

export type IncidentBoardRow = {
  report: HazardReport;
  section: BoardSection;
  code: string;
  placeLine: string;
  urgency: BoardUrgency;
  urgencyLabel: string;
  statusLine: string;
  responderLine: string;
  ctaLabel: string;
  ctaPrimary: boolean;
  relatedCount: number;
  badgeLabel: string | null;
  badgeTone: "critical" | "high" | "moderate" | "intake";
};

const REVIEW = new Set<ReportStatus>([
  "queued",
  "validating",
  "needs_review",
  "failed",
]);

const URGENT_HAZARDS = new Set(["flood", "landslide", "fire", "typhoon"]);

export function incidentDisplayCode(report: HazardReport, index: number): string {
  const tail = report.id.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase();
  if (tail.length >= 2) return `INC-${tail}`;
  return `INC-${String(40 + index).padStart(3, "0")}`;
}

function placeLine(report: HazardReport): string {
  const purok = report.citizenPurok?.trim();
  if (purok) return `${report.barangay} · ${purok}`;
  if (report.locationLabel?.trim()) {
    return `${report.barangay} · ${report.locationLabel.trim()}`;
  }
  return `${report.barangay}${report.lgu ? ` · ${report.lgu}` : ""}`;
}

function urgencyFor(report: HazardReport): BoardUrgency {
  if (REVIEW.has(report.status) && URGENT_HAZARDS.has(report.hazardHint)) {
    return "critical";
  }
  if (URGENT_HAZARDS.has(report.hazardHint)) return "high";
  return "moderate";
}

function urgencyLabel(u: BoardUrgency): string {
  if (u === "critical") return "Critical";
  if (u === "high") return "High urgency";
  return "Moderate";
}

function buildOperational(report: HazardReport, index: number, all: HazardReport[]): IncidentBoardRow {
  const urgency = urgencyFor(report);
  const related = relatedReports(report, all);
  const assigned = Boolean(report.investigatorUid || report.investigatorName);
  let statusLine = "Verified need · Ready";
  let responderLine = "No responder assigned";
  let ctaLabel = "Review Plan";
  let ctaPrimary = false;

  if (report.status === "rejected") {
    statusLine = "Closed · Rejected";
    responderLine = assigned
      ? `${report.investigatorName || "Officer"} · closed`
      : "No responder assigned";
    ctaLabel = "View Report";
  } else if (assigned) {
    statusLine = "Verified need · Dispatched";
    responderLine = report.investigatorName || "Officer assigned";
    ctaLabel = "Track Response";
  } else if (
    report.aiVerdict === "needs_review" ||
    (report.aiConfidence != null && report.aiConfidence < 0.7)
  ) {
    statusLine = "Unverified · Needs action";
    ctaLabel = "Review & Escalate";
    ctaPrimary = true;
  } else {
    statusLine = "Verified need · Approval pending";
    ctaLabel = "Review Plan";
  }

  return {
    report,
    section: "operational",
    code: incidentDisplayCode(report, index),
    placeLine: placeLine(report),
    urgency,
    urgencyLabel: urgencyLabel(urgency),
    statusLine,
    responderLine,
    ctaLabel,
    ctaPrimary,
    relatedCount: related.length + 1,
    badgeLabel: null,
    badgeTone: urgency,
  };
}

function buildIntake(report: HazardReport): IncidentBoardRow {
  const urgency = urgencyFor(report);
  const assigned = Boolean(report.investigatorUid || report.investigatorName);
  let statusLine = "Under review · Waiting for responder";
  if (report.status === "validating") statusLine = "AI validating · Hold";
  if (report.status === "failed") statusLine = "Validation failed · Needs action";
  if (report.status === "needs_review") {
    statusLine = "Needs review · Waiting for responder";
  }

  return {
    report,
    section: "intake",
    code: report.id,
    placeLine: placeLine(report),
    urgency,
    urgencyLabel: urgencyLabel(urgency),
    statusLine,
    responderLine: assigned
      ? `${report.investigatorName || "Officer"} · assigned`
      : `No assignment · ${report.lgu || "response area"}`,
    ctaLabel: "Review Report",
    ctaPrimary: false,
    relatedCount: 0,
    badgeLabel: "Citizen evidence · Unlinked",
    badgeTone: "intake",
  };
}

export function buildIncidentBoardRows(reports: HazardReport[]): {
  operational: IncidentBoardRow[];
  intake: IncidentBoardRow[];
  activeCount: number;
  completedCount: number;
  intakeCount: number;
} {
  const ranked = [...reports].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const operational: IncidentBoardRow[] = [];
  const intake: IncidentBoardRow[] = [];

  ranked.forEach((report, index) => {
    if (REVIEW.has(report.status)) {
      intake.push(buildIntake(report));
      return;
    }
    operational.push(buildOperational(report, index, ranked));
  });

  const completedCount = operational.filter(
    (r) => r.report.status === "rejected",
  ).length;
  const activeCount = operational.length - completedCount;

  return {
    operational,
    intake,
    activeCount,
    completedCount,
    intakeCount: intake.length,
  };
}

export function rowMatchesSearch(row: IncidentBoardRow, q: string): boolean {
  if (!q) return true;
  const hay = [
    row.code,
    row.placeLine,
    row.report.title,
    row.report.barangay,
    row.report.id,
    hazardHintLabel(row.report.hazardHint),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}
