import type { HazardReport } from "@/lib/reports/types";
import {
  buildAttentionBoard,
  type AttentionItem,
} from "@/lib/workspace/attentionBoard";
import { assistHref } from "@/lib/workspace/assistancePlan";
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

function householdsFromDetail(detail: string): string {
  const packs = detail.match(/(\d+)\s+food\s+packs/i);
  if (packs?.[1]) return `${packs[1]} households`;
  const kits = detail.match(/(\d+)\s+(?:medical\s+)?kits?/i);
  if (kits?.[1]) return `${Math.max(20, Number(kits[1]) * 40)} households`;
  return "Households TBD";
}

function toNeed(item: AttentionItem): ResourceNeed | null {
  if (item.kind === "resource") {
    return {
      id: item.id,
      kind: "shortage",
      incidentCode: item.incidentCode,
      place: placeFromItem(item),
      detail: item.detail,
      householdsLabel: householdsFromDetail(item.detail),
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
      detail: item.detail,
      householdsLabel: householdsFromDetail(item.detail),
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
    waterLiters: 0,
  };
}

function partnerFromApproval(item: AttentionItem): PartnerOffer {
  const medical = /medical|kit|red cross|rc-?\d/i.test(
    `${item.headline} ${item.detail}`,
  );
  return {
    id: `partner-${item.id}`,
    partner: medical ? "Red Cross Cebu" : "Partner supply",
    title: medical
      ? `Medical supplies offer · ${item.incidentCode}`
      : `Supply offer · ${item.incidentCode}`,
    detail: "Requires coordinator approval before commitment.",
    href: item.ctaHref,
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
    return {
      id: `act-${item.id}`,
      timeLabel: item.timeLabel.replace(" PHT", ""),
      community: placeFromItem(item),
      incidentCode: item.incidentCode,
      detail: item.detail,
      status: "pending",
      statusLabel: "Pending approval",
      actionLabel: "Review plan",
      actionHref: item.ctaHref,
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

/** Build the Resources desk from scoped reports + sample stock. */
export function buildResourceBoard(
  reports: HazardReport[],
  respondersAvailable: number,
): ResourceBoard {
  const attention = buildAttentionBoard(reports);
  const needs = attention.items
    .map(toNeed)
    .filter((n): n is ResourceNeed => Boolean(n));

  const shortageCommunities = new Set(
    needs.filter((n) => n.kind === "shortage").map((n) => n.place),
  ).size;
  const plansAwaiting = needs.filter((n) => n.kind === "approval").length;
  const approvalItems = attention.items.filter((i) => i.kind === "approval");
  const partnerOffers = approvalItems.map(partnerFromApproval);

  const { cells, waterLiters } = localStockFromInventory(
    NANGKA_SAMPLE_INVENTORY,
    respondersAvailable,
  );

  const aiAdvisory =
    approvalItems[0] != null
      ? "RC-7 matches the open kit need without using an unavailable local vehicle. The plan still needs fresh checks."
      : attention.shortages > 0
        ? "Local stock cannot cover open shortages. Confirm partner supply before committing packs or water."
        : null;

  const activity: ResourceActivityRow[] = [
    ...attention.items.map(activityFromItem),
    ...reports
      .filter((r) => r.status === "done" || r.status === "dispatched")
      .slice(0, 4)
      .map(activityFromDone),
  ].slice(0, 6);

  // Prefer a follow-up style row first when a shortage exists.
  const shortage = attention.items.find((i) => i.kind === "resource");
  if (shortage) {
    const followup: ResourceActivityRow = {
      id: `followup-${shortage.id}`,
      timeLabel: shortage.timeLabel.replace(" PHT", ""),
      community: placeFromItem(shortage),
      incidentCode: shortage.incidentCode,
      detail: "DSWD follow-up overdue. Confirm supply before committing packs.",
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
