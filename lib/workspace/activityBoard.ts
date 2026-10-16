import type { HazardReport } from "@/lib/reports/types";
import {
  buildAttentionBoard,
  type AttentionItem,
} from "@/lib/workspace/attentionBoard";
import type { AssistanceCommitment } from "@/lib/workspace/assistanceCommitments";
import {
  assistHref,
  type CompletedDelivery,
  type OtherUpdate,
} from "@/lib/workspace/assistancePlan";
import { parseReportNeed } from "@/lib/workspace/reportNeed";

export type ActivityFilter =
  | "all"
  | "in_progress"
  | "followup"
  | "completed"
  | "other";

export type ActivityTimelineStep = {
  id: "assigned" | "dispatched" | "arriving" | "delivered";
  label: string;
  timeLabel: string;
  state: "done" | "active" | "pending";
};

export type InProgressDelivery = {
  id: string;
  reportId: string;
  incidentCode: string;
  place: string;
  teamLabel: string;
  supplyLine: string;
  statusBadge: string;
  summaryLine: string;
  alertLine: string;
  vehicleLabel: string;
  officerLabel: string;
  steps: ActivityTimelineStep[];
  detailsHref: string;
  searchText: string;
};

export type FollowUpItem = {
  id: string;
  reportId: string;
  requestCode: string;
  title: string;
  detail: string;
  dueLine: string;
  timeLabel: string;
  metaLabel: string;
  tags: { label: string; tone: "critical" | "warn" | "muted" }[];
  ctaLabel: string;
  ctaHref: string;
  searchText: string;
};

export type ActivityBoard = {
  snapshotFull: string;
  updatedClock: string;
  inProgress: InProgressDelivery[];
  followUps: FollowUpItem[];
  completed: CompletedDelivery[];
  otherUpdates: OtherUpdate[];
  counts: {
    inProgress: number;
    followUp: number;
    completedToday: number;
    other: number;
    all: number;
  };
};

function clockPht(date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    }).format(date);
  } catch {
    return "—";
  }
}

function timeLabelPht(iso: string): string {
  return `${clockPht(new Date(iso))} PHT`;
}

function snapshotParts(date: Date): { full: string; clock: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  }).formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const dayPeriod = (
    parts.find((p) => p.type === "dayPeriod")?.value ?? ""
  ).toUpperCase();
  return {
    full: `${day} ${month} ${year} · Philippine Standard Time (PHT)`,
    clock: `${hour}:${minute} ${dayPeriod}`,
  };
}

function incidentCodeFor(report: HazardReport, index: number): string {
  const tail = report.id.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase();
  if (tail.length >= 2) return `INC-${tail}`;
  return `INC-${String(40 + index).padStart(3, "0")}`;
}

function asrCodeFor(report: HazardReport, index: number): string {
  const tail = report.id.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase();
  if (tail.length >= 2) return `ASR-${tail}`;
  return `ASR-${String(10 + index).padStart(3, "0")}`;
}

function placeOf(report: HazardReport): string {
  return (
    report.citizenPurok?.trim() ||
    report.locationLabel?.trim() ||
    report.barangay ||
    "Field"
  );
}

function placeFromItem(item: AttentionItem): string {
  const bits = item.detail.split("·").map((s) => s.trim());
  if (bits.length > 1 && bits[0] && bits[0].length < 80) return bits[0];
  return item.headline;
}

function supplyLineOf(report: HazardReport): string {
  const need = parseReportNeed(report);
  if (need.neededLabel && need.neededLabel !== "Ground check") {
    const packs = report.notes?.match(/(\d+)\s+food\s+packs/i)?.[1];
    const water = report.notes?.match(/(\d+)\s*L/i)?.[1];
    if (packs || water) {
      return `${packs ? `${packs} food packs` : ""}${packs && water ? " + " : ""}${water ? `${water} L water` : ""}`;
    }
    return need.neededLabel;
  }
  return report.title || "Relief assistance";
}

function householdsMeta(detail: string): string {
  const packs = detail.match(/(\d+)\s+food\s+packs/i);
  if (packs?.[1]) return `${packs[1]} households`;
  const kits = detail.match(/(\d+)\s+(?:medical\s+)?kits?/i);
  if (kits?.[1]) return `${Math.max(20, Number(kits[1]) * 30)} households`;
  return "Households TBD";
}

function neededMeta(detail: string): string {
  const kits = detail.match(/(\d+)\s+(?:medical\s+)?kits?/i);
  if (kits?.[1]) return `${kits[1]} kits`;
  const packs = detail.match(/(\d+)\s+food\s+packs/i);
  const water = detail.match(/(\d+)\s*L/i);
  if (packs?.[1] && water?.[1]) return `${packs[1]} packs + ${water[1]} L`;
  if (packs?.[1]) return `${packs[1]} packs`;
  return "Supply gap";
}

function isSamePhtDay(iso: string, now: Date): boolean {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(new Date(iso)) === fmt.format(now);
  } catch {
    return false;
  }
}

function teamFor(report: HazardReport, fallback: string): string {
  return report.dispatchLog?.called?.[0] || fallback;
}

function buildInProgress(
  report: HazardReport,
  index: number,
  now: Date,
): InProgressDelivery {
  const code = incidentCodeFor(report, index);
  const place = placeOf(report);
  const supply = supplyLineOf(report);
  const assignedAt = report.investigatedAt || report.validatedAt || report.createdAt;
  const dispatchedAt =
    report.dispatchLog?.at ||
    report.autoResponderCallAt ||
    report.updatedAt;
  const assignedMs = Date.parse(assignedAt);
  const dispatchedMs = Date.parse(dispatchedAt);
  const etaMs = Number.isFinite(dispatchedMs)
    ? dispatchedMs + 30 * 60 * 1000
    : now.getTime() + 15 * 60 * 1000;
  const etaDate = new Date(etaMs);
  const minsLeft = Math.max(0, Math.round((etaMs - now.getTime()) / 60000));
  const team = teamFor(report, "Team Alpha");
  const officer = report.investigatorName || "R. Dela Cruz";

  const steps: ActivityTimelineStep[] = [
    {
      id: "assigned",
      label: "Assigned",
      timeLabel: Number.isFinite(assignedMs) ? clockPht(new Date(assignedMs)) : "—",
      state: "done",
    },
    {
      id: "dispatched",
      label: "Dispatched",
      timeLabel: Number.isFinite(dispatchedMs)
        ? clockPht(new Date(dispatchedMs))
        : "—",
      state: "done",
    },
    {
      id: "arriving",
      label: "Arriving",
      timeLabel: `ETA ${clockPht(etaDate)}`,
      state: "active",
    },
    {
      id: "delivered",
      label: "Delivered",
      timeLabel: "Pending",
      state: "pending",
    },
  ];

  return {
    id: `prog-${report.id}`,
    reportId: report.id,
    incidentCode: code,
    place,
    teamLabel: team,
    supplyLine: supply,
    statusBadge: "On the way",
    summaryLine: `Dispatched at ${clockPht(new Date(dispatchedMs || now.getTime()))} · Estimated arrival ${clockPht(etaDate)}`,
    alertLine:
      minsLeft > 0
        ? `Awaiting arrival confirmation. ${team} is on the way. Estimated arrival is in ${minsLeft} minute${minsLeft === 1 ? "" : "s"}.`
        : `Awaiting arrival confirmation. ${team} should be on site. Confirm delivery when evidence is recorded.`,
    vehicleLabel: "Truck 01",
    officerLabel: officer,
    steps,
    detailsHref: `/admin/incidents/${encodeURIComponent(report.id)}`,
    searchText: `${place} ${code} ${supply} ${team}`.toLowerCase(),
  };
}

function buildCommitmentInProgress(
  c: AssistanceCommitment,
  report: HazardReport | undefined,
  index: number,
): InProgressDelivery {
  const place = c.place || (report ? placeOf(report) : "Field");
  const approvedMs = Date.parse(c.approvedAt);
  const now = Date.now();
  const etaMs = Number.isFinite(approvedMs)
    ? approvedMs + 30 * 60 * 1000
    : now + 20 * 60 * 1000;
  const etaDate = new Date(etaMs);
  const minsLeft = Math.max(0, Math.round((etaMs - now) / 60000));
  const team = report ? teamFor(report, c.partnerName) : c.partnerName;
  const supply = c.offerLine || (report ? supplyLineOf(report) : "Assistance");
  const officer = report?.investigatorName || "Coordinator";

  return {
    id: `commit-prog-${c.id}`,
    reportId: c.reportId,
    incidentCode: c.incidentCode,
    place,
    teamLabel: team,
    supplyLine: supply,
    statusBadge: "On the way",
    summaryLine: `Approved at ${clockPht(new Date(approvedMs || now))} · Estimated arrival ${clockPht(etaDate)}`,
    alertLine:
      minsLeft > 0
        ? `Awaiting arrival confirmation. ${team} is on the way. Estimated arrival is in ${minsLeft} minute${minsLeft === 1 ? "" : "s"}.`
        : `Awaiting arrival confirmation. ${team} should be on site. Confirm delivery when evidence is recorded.`,
    vehicleLabel: `Truck ${String((index % 3) + 1).padStart(2, "0")}`,
    officerLabel: officer,
    steps: [
      {
        id: "assigned",
        label: "Assigned",
        timeLabel: Number.isFinite(approvedMs)
          ? clockPht(new Date(approvedMs))
          : "—",
        state: "done",
      },
      {
        id: "dispatched",
        label: "Dispatched",
        timeLabel: Number.isFinite(approvedMs)
          ? clockPht(new Date(approvedMs + 5 * 60 * 1000))
          : "—",
        state: "done",
      },
      {
        id: "arriving",
        label: "Arriving",
        timeLabel: `ETA ${clockPht(etaDate)}`,
        state: "active",
      },
      {
        id: "delivered",
        label: "Delivered",
        timeLabel: "Pending",
        state: "pending",
      },
    ],
    detailsHref: assistHref(c.reportId),
    searchText: `${place} ${c.incidentCode} ${supply} ${team}`.toLowerCase(),
  };
}

function buildCompleted(
  report: HazardReport,
  index: number,
): CompletedDelivery {
  const code = incidentCodeFor(report, index);
  const place = placeOf(report);
  const supply = supplyLineOf(report);
  const team = teamFor(report, "Team Delta");
  return {
    id: `done-${report.id}`,
    reportId: report.id,
    incidentCode: code,
    place,
    teamLabel: team,
    supplyLine: supply,
    deliveredAt: `${clockPht(new Date(report.updatedAt || report.createdAt))} · Evidence recorded`,
    evidenceExtra:
      report.mediaUrl?.trim() || report.fieldEvidence?.length ? 2 : 0,
    mediaUrl:
      report.mediaUrl?.trim() ||
      report.fieldEvidence?.[0]?.mediaUrl?.trim() ||
      null,
    vehicleLabel: "Truck 02",
    officerLabel: report.investigatorName || "L. Rivera",
    detailsHref: `/admin/incidents/${encodeURIComponent(report.id)}`,
  };
}

function buildFollowUp(
  item: AttentionItem,
  report: HazardReport | undefined,
  index: number,
): FollowUpItem {
  const place = placeFromItem(item);
  const need = report ? parseReportNeed(report) : null;
  const packs = item.detail.match(/(\d+)\s+food\s+packs/i)?.[1];
  const water = item.detail.match(/(\d+)\s*L/i)?.[1];
  const meta =
    packs || water
      ? `${packs ? `${packs} packs` : ""}${packs && water ? " + " : ""}${water ? `${water} L` : ""}`
      : need?.neededLabel || item.meta || "Supply gap";
  const requestCode = report ? asrCodeFor(report, index) : `ASR-${String(10 + index).padStart(3, "0")}`;
  const dueClock = item.timeLabel.replace(" PHT", "");

  return {
    id: `followup-${item.id}`,
    reportId: item.reportId,
    requestCode,
    title: "DSWD extra supply request",
    detail:
      packs || water
        ? `${packs ? `${packs} food packs` : ""}${packs && water ? " and " : ""}${water ? `${water} L water` : ""} requested. Partner quantity and ETA are still unconfirmed.`
        : `${item.detail} Partner quantity and ETA are still unconfirmed.`,
    dueLine: `Follow-up was due ${dueClock} · No response yet.`,
    timeLabel: item.timeLabel,
    metaLabel: meta,
    tags: [
      { label: "Follow-up due", tone: "critical" },
      { label: "External request", tone: "warn" },
      { label: requestCode, tone: "muted" },
    ],
    ctaLabel: "Follow up request",
    ctaHref: assistHref(item.reportId),
    searchText: `${place} ${requestCode} ${item.incidentCode} dswd ${item.detail}`.toLowerCase(),
  };
}

function buildOtherUpdates(attentionItems: AttentionItem[]): OtherUpdate[] {
  return attentionItems
    .filter((i) => i.kind === "approval" || i.kind === "critical")
    .slice(0, 8)
    .map((item) => {
      if (item.kind === "approval") {
        return {
          id: `upd-${item.id}`,
          kind: "offer" as const,
          reportId: item.reportId,
          incidentCode: item.incidentCode,
          place: placeFromItem(item),
          tags: [
            { label: "External offer", tone: "info" as const },
            { label: "Approval pending", tone: "warn" as const },
            { label: item.incidentCode, tone: "muted" as const },
          ],
          detail: /red cross|medical|kit/i.test(item.detail)
            ? `External Red Cross offer: ${neededMeta(item.detail)} confirmed at ${item.timeLabel.replace(" PHT", "")}. Commitment not yet approved.`
            : item.detail,
          timeLabel: item.timeLabel,
          metaLabel: neededMeta(item.detail),
          ctaLabel: "Review resource plan",
          ctaHref: assistHref(item.reportId),
        };
      }
      return {
        id: `upd-${item.id}`,
        kind: "critical" as const,
        reportId: item.reportId,
        incidentCode: item.incidentCode,
        place: placeFromItem(item),
        tags: [
          { label: "Critical", tone: "critical" as const },
          ...item.tags
            .filter((t) => t.label !== "Critical")
            .slice(0, 1)
            .map((t) => ({
              label: t.label,
              tone: (t.tone === "critical" ? "critical" : "warn") as
                | "critical"
                | "warn",
            })),
          { label: item.incidentCode, tone: "muted" as const },
        ],
        detail:
          item.detail.includes("·")
            ? item.detail.split("·").slice(1).join("·").trim() ||
              "Incident awaiting a response. Claims remain unverified and no rescue team is assigned."
            : item.detail ||
              "Incident awaiting a response. Claims remain unverified and no rescue team is assigned.",
        timeLabel: item.timeLabel,
        metaLabel: householdsMeta(item.detail),
        ctaLabel: "Review incident",
        ctaHref: item.ctaHref,
      };
    });
}

/** Build the Activity desk from scoped reports + assistance commitments. */
export function buildActivityBoard(
  reports: HazardReport[],
  commitments: AssistanceCommitment[] = [],
  now = new Date(),
): ActivityBoard {
  const attention = buildAttentionBoard(reports);
  const reportById = new Map(reports.map((r) => [r.id, r]));
  const doneIds = new Set(
    reports.filter((r) => r.status === "done").map((r) => r.id),
  );
  const dispatched = reports.filter((r) => r.status === "dispatched");
  const done = reports.filter((r) => r.status === "done");

  const inProgressFromReports = dispatched.map((r, i) =>
    buildInProgress(r, i, now),
  );
  const covered = new Set(inProgressFromReports.map((r) => r.reportId));

  const inProgressFromCommitments = commitments
    .filter((c) => !doneIds.has(c.reportId) && !covered.has(c.reportId))
    .slice(0, 4)
    .map((c, i) =>
      buildCommitmentInProgress(c, reportById.get(c.reportId), i),
    );

  const inProgress = [...inProgressFromReports, ...inProgressFromCommitments];

  const shortageItems = attention.items.filter((i) => i.kind === "resource");
  const followUps = shortageItems
    .slice(0, 4)
    .map((item, i) => buildFollowUp(item, reportById.get(item.reportId), i));

  const followReportIds = new Set(followUps.map((f) => f.reportId));
  const otherUpdates = buildOtherUpdates(
    attention.items.filter((i) => !followReportIds.has(i.reportId)),
  );

  const completed = done
    .slice(0, 8)
    .map((r, i) => buildCompleted(r, i));

  const completedToday = completed.filter((c) => {
    const report = reportById.get(c.reportId);
    if (!report) return false;
    return isSamePhtDay(report.updatedAt || report.createdAt, now);
  }).length;

  const snap = snapshotParts(now);
  const counts = {
    inProgress: inProgress.length,
    followUp: followUps.length,
    completedToday: completedToday || completed.length,
    other: otherUpdates.length,
    all:
      inProgress.length +
      followUps.length +
      completed.length +
      otherUpdates.length,
  };

  return {
    snapshotFull: snap.full,
    updatedClock: snap.clock,
    inProgress,
    followUps,
    completed,
    otherUpdates,
    counts,
  };
}
