import type { HazardReport } from "@/lib/reports/types";
import {
  buildAttentionBoard,
  type AttentionItem,
} from "@/lib/workspace/attentionBoard";
import type { ResourcePartner } from "@/lib/partners/types";
import { partnerSupplyLabel } from "@/lib/partners/types";
import { parseReportNeed } from "@/lib/workspace/reportNeed";
import {
  NANGKA_SAMPLE_INVENTORY,
  type SampleInventoryItem,
} from "@/lib/workspace/sampleInventory";

export type AssistStepId =
  | "identify"
  | "explore"
  | "review"
  | "approve";

export const ASSIST_STEPS: {
  id: AssistStepId;
  label: string;
}[] = [
  { id: "identify", label: "Identify shortage" },
  { id: "explore", label: "Explore options" },
  { id: "review", label: "Review resource plan" },
  { id: "approve", label: "Approve and track" },
];

export type AssistLocalCell = {
  id: string;
  label: string;
  available: number;
  hint: string;
  ok: boolean;
};

export type PartnerOption = {
  id: string;
  partner: string;
  recommended: boolean;
  categoryLine: string;
  offerLine: string;
  statusLine: string;
  etaLine: string;
  helps: string[];
  relatedIncident: string;
};

export type CompletedDelivery = {
  id: string;
  reportId: string;
  incidentCode: string;
  place: string;
  teamLabel: string;
  supplyLine: string;
  deliveredAt: string;
  evidenceExtra: number;
  mediaUrl: string | null;
  vehicleLabel: string;
  officerLabel: string;
  detailsHref: string;
};

export type OtherUpdateKind = "offer" | "critical";

export type OtherUpdate = {
  id: string;
  kind: OtherUpdateKind;
  reportId: string;
  incidentCode: string;
  place: string;
  tags: { label: string; tone: "info" | "warn" | "critical" | "muted" }[];
  detail: string;
  timeLabel: string;
  metaLabel: string;
  ctaLabel: string;
  ctaHref: string;
};

export type AssistancePlan = {
  planCode: string;
  reportId: string;
  incidentCode: string;
  place: string;
  detail: string;
  householdsLabel: string;
  neededLabel: string;
  kindLabel: string;
  localStock: AssistLocalCell[];
  lastCheckLabel: string;
  partners: PartnerOption[];
  aiHeadline: string;
  aiBody: string;
  considerations: string[];
  nextStepCopy: string;
  completed: CompletedDelivery[];
  otherUpdates: OtherUpdate[];
};

function incidentCodeFor(
  report: HazardReport,
  index: number,
): string {
  const tail = report.id.replace(/[^a-zA-Z0-9]/g, "").slice(-3).toUpperCase();
  if (tail.length >= 2) return `INC-${tail}`;
  return `INC-${String(40 + index).padStart(3, "0")}`;
}

function buildCompleted(reports: HazardReport[]): CompletedDelivery[] {
  return reports
    .filter((r) => r.status === "done" || r.status === "dispatched")
    .slice(0, 3)
    .map((report, index) => {
      const code = incidentCodeFor(report, index);
      const place =
        report.citizenPurok?.trim() ||
        report.locationLabel?.trim() ||
        report.barangay ||
        "Field";
      const packs = report.notes?.match(/(\d+)\s+food\s+packs/i)?.[1];
      const water = report.notes?.match(/(\d+)\s*L/i)?.[1];
      const supplyLine =
        packs || water
          ? `${packs ? `${packs} food packs` : ""}${packs && water ? " + " : ""}${water ? `${water} L water` : ""}`
          : report.title || "Relief assistance delivered";
      return {
        id: `done-${report.id}`,
        reportId: report.id,
        incidentCode: code,
        place,
        teamLabel: report.dispatchLog?.called?.[0] || "Team Delta",
        supplyLine,
        deliveredAt: `${clockPht(new Date(report.updatedAt || report.createdAt))} · Evidence recorded`,
        evidenceExtra: report.mediaUrl?.trim() ? 2 : 0,
        mediaUrl: report.mediaUrl?.trim() || null,
        vehicleLabel: "Truck 02",
        officerLabel: report.investigatorName || "L. Rivera",
        detailsHref: `/admin/incidents/${encodeURIComponent(report.id)}`,
      };
    });
}

function buildOtherUpdates(
  attentionItems: AttentionItem[],
  focusReportId: string,
): OtherUpdate[] {
  return attentionItems
    .filter((i) => i.reportId !== focusReportId)
    .filter((i) => i.kind === "approval" || i.kind === "critical")
    .slice(0, 4)
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
          detail: item.detail,
          timeLabel: item.timeLabel.replace(" PHT", " PHT"),
          metaLabel: neededFromDetail(item.detail),
          ctaLabel: "Review resource plan",
          ctaHref: `/admin/resources/assist?report=${encodeURIComponent(item.reportId)}`,
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
        detail: item.detail,
        timeLabel: item.timeLabel,
        metaLabel: householdsFromDetail(item.detail),
        ctaLabel: "Review incident",
        ctaHref: item.ctaHref,
      };
    });
}

function placeFromItem(item: AttentionItem): string {
  const bits = item.detail.split("·").map((s) => s.trim());
  if (bits.length > 1 && bits[0] && bits[0].length < 80) return bits[0];
  return item.headline;
}

function neededFromDetail(detail: string): string {
  const kits = detail.match(/(\d+)\s+(?:medical\s+)?kits?/i);
  if (kits?.[1]) return `${kits[1]} kits`;
  const packs = detail.match(/(\d+)\s+food\s+packs/i);
  const water = detail.match(/(\d+)\s*L/i);
  if (packs?.[1] && water?.[1]) return `${packs[1]} packs · ${water[1]} L`;
  if (packs?.[1]) return `${packs[1]} packs`;
  return "Supply gap";
}

function householdsFromDetail(detail: string): string {
  const packs = detail.match(/(\d+)\s+food\s+packs/i);
  if (packs?.[1]) return `${packs[1]} households`;
  const kits = detail.match(/(\d+)\s+(?:medical\s+)?kits?/i);
  if (kits?.[1]) return `${Math.max(20, Number(kits[1]) * 30)} households`;
  return "Households TBD";
}

function planCodeFromId(reportId: string): string {
  let n = 0;
  for (let i = 0; i < reportId.length; i++) {
    n = (n + reportId.charCodeAt(i) * (i + 1)) % 900;
  }
  return `AL-${String(18 + (n % 80)).padStart(3, "0")}`;
}

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

function localCells(
  inventory: SampleInventoryItem[],
  responders: number,
): AssistLocalCell[] {
  const byId = (id: string) =>
    inventory.find((i) => i.id === id)?.available ?? 0;
  const food = byId("rice-sacks") + byId("evac-kits");
  const medical = byId("first-aid");
  const water = byId("water-jugs");

  return [
    {
      id: "food",
      label: "Food packs",
      available: food,
      hint: food > 0 ? "Recheck coverage" : "Insufficient stock",
      ok: food > 0,
    },
    {
      id: "water",
      label: "Water (L)",
      available: water,
      hint: water > 0 ? "Recheck coverage" : "Insufficient stock",
      ok: water > 0,
    },
    {
      id: "medical",
      label: "Medical kits",
      available: medical,
      hint: medical > 0 ? "Recheck coverage" : "Insufficient stock",
      ok: medical > 0,
    },
    {
      id: "responders",
      label: "Responders",
      available: responders,
      hint: responders > 0 ? "Recheck coverage" : "Insufficient stock",
      ok: responders > 0,
    },
  ];
}

function pickFocus(
  attentionItems: AttentionItem[],
  reportId: string | null,
): AttentionItem | null {
  if (reportId) {
    const hit = attentionItems.find((i) => i.reportId === reportId);
    if (hit) return hit;
  }
  return (
    attentionItems.find((i) => i.kind === "resource") ||
    attentionItems.find((i) => i.kind === "approval") ||
    attentionItems[0] ||
    null
  );
}

function etaPlusMinutes(mins: number): string {
  try {
    const d = new Date(Date.now() + mins * 60_000);
    return `${clockPht(d)} PHT`;
  } catch {
    return "pending recheck";
  }
}

function needWantsMedical(focus: AttentionItem): boolean {
  return /medical|kit|red cross|rc-?\d/i.test(
    `${focus.headline} ${focus.detail}`,
  );
}

function partnerMatchesNeed(
  partner: ResourcePartner,
  wantsMedical: boolean,
): boolean {
  if (wantsMedical) return partner.supplies.includes("medical");
  return (
    partner.supplies.includes("food") || partner.supplies.includes("water")
  );
}

function optionFromDirectory(
  partner: ResourcePartner,
  focus: AttentionItem,
  recommended: boolean,
): PartnerOption {
  const confirmedAt = clockPht(new Date());
  const category =
    partner.supplies.map(partnerSupplyLabel).join(" · ") ||
    partner.coverage ||
    "External supply";
  const medical = partner.supplies.includes("medical");
  return {
    id: partner.id,
    partner: partner.name,
    recommended,
    categoryLine: category,
    offerLine: recommended
      ? `${neededFromDetail(focus.detail)} confirmed · Recheck before allocation`
      : `${neededFromDetail(focus.detail)} available on request`,
    statusLine: recommended
      ? `Partner confirmed ${confirmedAt} PHT · ${partner.contactName}`
      : `Unconfirmed · Call ${partner.contactName || partner.phone}`,
    etaLine: recommended
      ? `Est. arrival ${etaPlusMinutes(70)}${medical || partner.supplies.includes("transport") ? " · Partner transport" : ""}`
      : "ETA to be determined",
    helps: [
      `${focus.incidentCode} need`,
      recommended
        ? "No local stock used"
        : "Confirm before linking to this incident",
      partner.notes?.trim() || "Fresh checks still required",
    ],
    relatedIncident: focus.incidentCode,
  };
}

function buildPartners(
  focus: AttentionItem,
  others: AttentionItem[],
  directory: ResourcePartner[],
): PartnerOption[] {
  const wantsMedical = needWantsMedical(focus);
  const active = directory.filter((p) => p.status === "active");

  if (active.length > 0) {
    const ranked = [...active].sort((a, b) => {
      const am = partnerMatchesNeed(a, wantsMedical) ? 0 : 1;
      const bm = partnerMatchesNeed(b, wantsMedical) ? 0 : 1;
      if (am !== bm) return am - bm;
      return a.name.localeCompare(b.name);
    });
    return ranked.slice(0, 4).map((p, i) =>
      optionFromDirectory(p, focus, i === 0 && partnerMatchesNeed(p, wantsMedical)),
    );
  }

  // Fallback labels when the directory is empty (demo / first load).
  const confirmedAt = clockPht(new Date());
  const primary: PartnerOption = wantsMedical
    ? {
        id: "red-cross",
        partner: "Red Cross Cebu",
        recommended: true,
        categoryLine: "Medical and relief supplies",
        offerLine: `${neededFromDetail(focus.detail)} confirmed · Recheck before allocation`,
        statusLine: `Partner confirmed ${confirmedAt} PHT`,
        etaLine: `Est. arrival ${etaPlusMinutes(70)} · Partner transport`,
        helps: [
          `${focus.incidentCode} medical need`,
          "No local medical stock used",
          "Fresh checks still required",
        ],
        relatedIncident: focus.incidentCode,
      }
    : {
        id: "dswd",
        partner: "DSWD Regional Office",
        recommended: true,
        categoryLine: "Food and water",
        offerLine: `${neededFromDetail(focus.detail)} requested`,
        statusLine: "Unconfirmed",
        etaLine: "ETA to be determined",
        helps: [
          `${focus.incidentCode} supply need`,
          "Local stock recheck required",
          "Partner confirmation still open",
        ],
        relatedIncident: focus.incidentCode,
      };

  const secondaryItem =
    others.find((i) => i.reportId !== focus.reportId) || null;

  const secondary: PartnerOption = secondaryItem
    ? {
        id: wantsMedical ? "dswd" : "red-cross",
        partner: wantsMedical ? "DSWD Regional Office" : "Red Cross Cebu",
        recommended: false,
        categoryLine: wantsMedical
          ? `Food and water · Separate need ${secondaryItem.incidentCode}`
          : `Medical and relief · ${secondaryItem.incidentCode}`,
        offerLine: wantsMedical
          ? `${neededFromDetail(secondaryItem.detail)} requested`
          : `${neededFromDetail(secondaryItem.detail)} confirmed`,
        statusLine: wantsMedical
          ? "Unconfirmed"
          : `Partner confirmed ${confirmedAt} PHT`,
        etaLine: wantsMedical
          ? "ETA to be determined"
          : `Est. arrival ${etaPlusMinutes(90)} · Partner transport`,
        helps: [
          `Separate need for ${secondaryItem.incidentCode}`,
          "Not a substitute for the selected need",
        ],
        relatedIncident: secondaryItem.incidentCode,
      }
    : {
        id: wantsMedical ? "dswd" : "partner-alt",
        partner: wantsMedical ? "DSWD Regional Office" : "Partner supply desk",
        recommended: false,
        categoryLine: "Food and water · Separate desk request",
        offerLine: "Separate food/water desk request",
        statusLine: "Unconfirmed",
        etaLine: "ETA to be determined",
        helps: [
          "Separate food/water need",
          "Add partners under Databases → Partners",
        ],
        relatedIncident: "—",
      };

  return [primary, secondary];
}

/** Build the Find assistance desk for a focused report (or first open need). */
export function buildAssistancePlan(
  reports: HazardReport[],
  respondersAvailable: number,
  reportId: string | null,
  directory: ResourcePartner[] = [],
): AssistancePlan | null {
  const attention = buildAttentionBoard(reports);
  const focus = pickFocus(attention.items, reportId);
  if (!focus) return null;

  const localStock = localCells(NANGKA_SAMPLE_INVENTORY, respondersAvailable);
  const partners = buildPartners(
    focus,
    attention.items.filter((i) => i.kind === "resource" || i.kind === "approval"),
    directory,
  );
  const recommended = partners.find((p) => p.recommended) || partners[0]!;
  const planCode = planCodeFromId(focus.reportId);
  const medicalLow = !localStock.find((c) => c.id === "medical")?.ok;
  const foodLow = !localStock.find((c) => c.id === "food")?.ok;

  const completed = buildCompleted(reports);
  const otherUpdates = buildOtherUpdates(attention.items, focus.reportId);
  const focusReport =
    reports.find((r) => r.id === focus.reportId) ?? null;
  const parsedNeed = focusReport
    ? parseReportNeed(focusReport)
    : {
        detail: focus.detail,
        neededLabel: neededFromDetail(focus.detail),
        householdsLabel: householdsFromDetail(focus.detail),
        short: true,
      };

  return {
    planCode,
    reportId: focus.reportId,
    incidentCode: focus.incidentCode,
    place: placeFromItem(focus),
    detail: parsedNeed.detail,
    householdsLabel: parsedNeed.householdsLabel,
    neededLabel: parsedNeed.neededLabel,
    kindLabel: focus.kind === "approval" ? "Approval needed" : "Shortage",
    localStock,
    lastCheckLabel: `${clockPht(new Date())} PHT`,
    partners,
    aiHeadline: `Use the confirmed ${recommended.partner} offer`,
    aiBody: `${recommended.partner} can support “${parsedNeed.neededLabel}” for ${focus.incidentCode} without drawing unavailable local stock. Recheck before commitment.`,
    considerations: [
      medicalLow ? "Local medical kits show 0 available." : null,
      "Partner confirmation is recent; recheck before commitment.",
      foodLow || partners[1]
        ? `A separate food/water need remains ${partners[1]?.statusLine.toLowerCase() ?? "unconfirmed"}.`
        : null,
    ].filter((s): s is string => Boolean(s)),
    nextStepCopy: `Proceed to review ${planCode}: confirm the details, recheck availability, and prepare for human approval. Nothing is assigned yet.`,
    completed,
    otherUpdates,
  };
}

export function assistHref(reportId: string): string {
  return `/admin/resources/assist?report=${encodeURIComponent(reportId)}`;
}
