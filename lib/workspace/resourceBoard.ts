import type { HazardReport } from "@/lib/reports/types";
import {
  buildAttentionBoard,
  type AttentionItem,
} from "@/lib/workspace/attentionBoard";
import type { AssistanceCommitment } from "@/lib/workspace/assistanceCommitments";
import { assistHref } from "@/lib/workspace/assistancePlan";
import { parseReportNeed } from "@/lib/workspace/reportNeed";
import {
  NANGKA_SAMPLE_INVENTORY,
  type SampleInventoryItem,
} from "@/lib/workspace/sampleInventory";

export type ResourceNeedKind = "shortage" | "approval";

export type ResourceNeed = {
  id: string;
  kind: ResourceNeedKind;
  incidentCode: string;
  place: string;
  detail: string;
  householdsLabel: string;
  neededLabel: string;
  ctaLabel: string;
  ctaHref: string;
  primaryCta: boolean;
  reportId: string;
};

export type LocalStockCell = {
  id: string;
  label: string;
  available: number;
  ok: boolean;
};

export type PartnerOffer = {
  id: string;
  partner: string;
  title: string;
  detail: string;
  href: string;
};

export type ResourceActivityStatus =
  | "followup"
  | "pending"
  | "completed"
  | "assistance";

export type ResourceActivityRow = {
  id: string;
  timeLabel: string;
  community: string;
  incidentCode: string;
  detail: string;
  status: ResourceActivityStatus;
  statusLabel: string;
  actionLabel: string;
  actionHref: string;
};

export type ResourceBoard = {
  shortageCommunities: number;
  plansAwaiting: number;
  partnerOffersAwaiting: number;
  respondersAvailable: number;
  needs: ResourceNeed[];
  localStock: LocalStockCell[];
  waterLiters: number;
  lastCheckLabel: string;
  partnerOffers: PartnerOffer[];
  aiAdvisory: string | null;
  activity: ResourceActivityRow[];
};

function placeFromItem(item: AttentionItem): string {
  const bits = item.detail.split("·").map((s) => s.trim());
  if (bits.length > 1 && bits[0] && bits[0].length < 80) return bits[0];
  return item.headline;
}

function toNeed(
  item: AttentionItem,
  reportById: Map<string, HazardReport>,
): ResourceNeed | null {
  const report = reportById.get(item.reportId);
  const parsed = report ? parseReportNeed(report) : null;
  const householdsLabel = parsed?.householdsLabel ?? "Households TBD";
  const neededCore = parsed?.neededLabel ?? item.meta ?? "Response TBD";
  const detail = parsed?.detail ?? item.detail;

  if (item.kind === "resource") {
    return {
      id: item.id,
      kind: "shortage",
      incidentCode: item.incidentCode,
      place: placeFromItem(item),
      detail,
      householdsLabel,
      neededLabel: `Needed: ${neededCore}`,
      ctaLabel: "Find assistance",
      ctaHref: assistHref(item.reportId),
      primaryCta: true,
      reportId: item.reportId,
    };
  }
  if (item.kind === "approval") {
    return {
      id: item.id,
      kind: "approval",
      incidentCode: item.incidentCode,
      place: placeFromItem(item),
      detail,
      householdsLabel,
      neededLabel: `Proposed: ${neededCore}`,
      ctaLabel: "View inventory",
      ctaHref: "#inventory",
      primaryCta: false,
      reportId: item.reportId,
    };
  }
  return null;
}

function stockCell(
  id: string,
  label: string,
  available: number,
): LocalStockCell {
  return { id, label, available, ok: available > 0 };
}

function localStockFromInventory(
  inventory: SampleInventoryItem[],
  responders: number,
): { cells: LocalStockCell[]; waterLiters: number } {
  const byId = (id: string) =>
    inventory.find((i) => i.id === id)?.available ?? 0;

  return {
    cells: [
      stockCell("responders", "Responders", responders),
      stockCell("vehicles", "Vehicles", byId("rescue-boats")),
      stockCell(
        "food",
        "Food packs",
        byId("rice-sacks") + byId("evac-kits"),
      ),
      stockCell("medical", "Medical kits", byId("first-aid")),
    ],
    waterLiters: byId("water-jugs"),
  };
}

function partnerFromApproval(item: AttentionItem): PartnerOffer {
  const medical = /medical|kit|red cross|rc-?\d/i.test(
    `${item.headline} ${item.detail}`,
  );
  const kits = item.detail.match(/(\d+)\s+(?:medical\s+)?kits?/i)?.[1] ?? "2";
  const time = item.timeLabel.replace(" PHT", "");
  return {
    id: `partner-${item.id}`,
    partner: medical ? "Red Cross Cebu" : "Partner supply",
    title: medical
      ? `Medical supplies offer · ${item.incidentCode}`
      : `Supply offer · ${item.incidentCode}`,
    detail: medical
      ? `${kits} kits confirmed at ${time} by C. Lim. Requires coordinator approval.`
      : "Requires coordinator approval before commitment.",
    href: assistHref(item.reportId),
  };
}

function activityFromItem(item: AttentionItem): ResourceActivityRow {
  if (item.kind === "resource") {
    return {
      id: `act-${item.id}`,
      timeLabel: item.timeLabel.replace(" PHT", ""),
      community: placeFromItem(item),
      incidentCode: item.incidentCode,
      detail: item.detail,
      status: "assistance",
      statusLabel: "Needs assistance",
      actionLabel: "Find assistance",
      actionHref: assistHref(item.reportId),
    };
  }
  if (item.kind === "approval") {
    const kits = item.detail.match(/(\d+)\s+(?:medical\s+)?kits?/i)?.[1];
    return {
      id: `act-${item.id}`,
      timeLabel: item.timeLabel.replace(" PHT", ""),
      community: placeFromItem(item),
      incidentCode: item.incidentCode,
      detail: kits
        ? `Red Cross Cebu confirmed ${kits} medical kits. Human approval pending.`
        : item.detail,
      status: "pending",
      statusLabel: "Pending approval",
      actionLabel: "Review plan",
      actionHref: assistHref(item.reportId),
    };
  }
  return {
    id: `act-${item.id}`,
    timeLabel: item.timeLabel.replace(" PHT", ""),
    community: placeFromItem(item),
    incidentCode: item.incidentCode,
    detail: item.detail,
    status: "followup",
    statusLabel: "Needs follow-up",
    actionLabel: "Review incident",
    actionHref: item.ctaHref,
  };
}

function activityFromDone(report: HazardReport, index: number): ResourceActivityRow {
  const tail = report.id.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase();
  const code =
    tail.length >= 2 ? `INC-${tail}` : `INC-${String(50 + index).padStart(3, "0")}`;
  let timeLabel = "—";
  try {
    timeLabel = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    }).format(new Date(report.updatedAt || report.createdAt));
  } catch {
    /* keep dash */
  }
  return {
    id: `done-${report.id}`,
    timeLabel,
    community: report.citizenPurok || report.barangay || "Field",
    incidentCode: code,
    detail:
      report.notes?.trim() ||
      report.title ||
      "Resource movement recorded.",
    status: "completed",
    statusLabel: "Completed",
    actionLabel: "View evidence",
    actionHref: `/admin/incidents/${encodeURIComponent(report.id)}`,
  };
}

function formatLastCheck(date: Date): string {
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

function commitmentActivity(c: AssistanceCommitment): ResourceActivityRow {
  let timeLabel = "—";
  try {
    timeLabel = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    }).format(new Date(c.approvedAt));
  } catch {
    /* keep dash */
  }
  return {
    id: `commit-${c.id}`,
    timeLabel,
    community: c.place,
    incidentCode: c.incidentCode,
    detail: `${c.partnerName} committed via ${c.planCode}. ${c.offerLine}`,
    status: "completed",
    statusLabel: "Assistance approved",
    actionLabel: "View plan",
    actionHref: assistHref(c.reportId),
  };
}

function needFromReport(report: HazardReport): ResourceNeed {
  const parsed = parseReportNeed(report);
  const codeTail = report.id
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-3)
    .toUpperCase();
  return {
    id: `shortage-${report.id}`,
    kind: "shortage",
    incidentCode: `INC-${codeTail || "041"}`,
    place: report.citizenPurok || report.barangay || "Nangka",
    detail: parsed.detail,
    householdsLabel: parsed.householdsLabel,
    neededLabel: `Needed: ${parsed.neededLabel}`,
    ctaLabel: "Find assistance",
    ctaHref: assistHref(report.id),
    primaryCta: true,
    reportId: report.id,
  };
}

function demoNeeds(reports: HazardReport[]): ResourceNeed[] {
  const open = reports.filter(
    (r) => r.status !== "rejected" && r.status !== "done",
  );
  if (open.length === 0) return [];
  return open.slice(0, 2).map(needFromReport);
}

/** Build the Resources desk from scoped reports + live sample stock. */
export function buildResourceBoard(
  reports: HazardReport[],
  respondersAvailable: number,
  commitments: AssistanceCommitment[] = [],
): ResourceBoard {
  const attention = buildAttentionBoard(reports);
  const reportById = new Map(reports.map((r) => [r.id, r]));
  // Keep shortage cards visible even after approval so Find assistance stays findable.
  const openItems = attention.items;
  let needs = openItems
    .map((item) => toNeed(item, reportById))
    .filter((n): n is ResourceNeed => Boolean(n));

  // Prefer a clear shortage from Verified/Queue reports when stock is empty.
  const verifiedShort = reports.filter(
    (r) =>
      (r.status === "legit" || r.status === "queued" || r.status === "assigned") &&
      parseReportNeed(r).short &&
      !/medical|kit|red cross/i.test(`${r.title ?? ""} ${r.notes ?? ""}`),
  );
  for (const report of verifiedShort) {
    if (needs.some((n) => n.reportId === report.id && n.kind === "shortage")) {
      continue;
    }
    needs.unshift(needFromReport(report));
  }

  if (needs.length === 0) {
    needs = demoNeeds(reports);
  }

  // De-dupe by reportId+kind, prefer shortage.
  const seen = new Set<string>();
  needs = needs.filter((n) => {
    const key = `${n.reportId}:${n.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const shortageCommunities = new Set(
    needs.filter((n) => n.kind === "shortage").map((n) => n.place),
  ).size;
  const plansAwaiting = needs.filter((n) => n.kind === "approval").length;
  const approvalItems = openItems.filter((i) => i.kind === "approval");
  const partnerOffers = approvalItems.map(partnerFromApproval);

  const { cells, waterLiters } = localStockFromInventory(
    NANGKA_SAMPLE_INVENTORY,
    respondersAvailable,
  );

  const kitOffer = approvalItems.find((i) =>
    /kit|medical|red cross|rc-?\d/i.test(`${i.headline} ${i.detail}`),
  );
  const aiAdvisory =
    kitOffer != null
      ? "RC-7 matches the open kit need without using an unavailable local vehicle. The plan still needs fresh checks."
      : needs.some((n) => n.kind === "shortage")
        ? "Local stock cannot cover open shortages. Confirm partner supply before committing packs or water."
        : null;

  const activity: ResourceActivityRow[] = [
    ...commitments.slice(0, 3).map(commitmentActivity),
    ...openItems.map(activityFromItem),
    ...reports
      .filter((r) => r.status === "done" || r.status === "dispatched")
      .slice(0, 4)
      .map(activityFromDone),
  ].slice(0, 6);

  const shortage = openItems.find((i) => i.kind === "resource");
  if (shortage) {
    const followup: ResourceActivityRow = {
      id: `followup-${shortage.id}`,
      timeLabel: shortage.timeLabel.replace(" PHT", ""),
      community: placeFromItem(shortage),
      incidentCode: shortage.incidentCode,
      detail:
        "DSWD follow-up overdue. Confirm supply before committing packs.",
      status: "followup",
      statusLabel: "Needs follow-up",
      actionLabel: "Find assistance",
      actionHref: assistHref(shortage.reportId),
    };
    activity.unshift(followup);
  }

  return {
    shortageCommunities,
    plansAwaiting,
    partnerOffersAwaiting: partnerOffers.length,
    respondersAvailable,
    needs,
    localStock: cells,
    waterLiters,
    lastCheckLabel: formatLastCheck(new Date()),
    partnerOffers,
    aiAdvisory,
    activity: activity.slice(0, 6),
  };
}
