import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import type { OfficerProfile } from "@/lib/auth/types";
import { getClientDb } from "@/lib/firebase/client";
import {
  evacConditionLabel,
  type EvacCenter,
} from "@/lib/evacCenters/types";
import { newRequestReportId } from "@/lib/reports/reportId";
import type { ReportPriority } from "@/lib/reports/types";
import { EMPTY_REACTION_COUNTS } from "@/lib/reports/socialTypes";
import { computeReportTrust } from "@/lib/reports/trustScore";

export type EvacRequestResourceId =
  | "foodPacks"
  | "waterLiters"
  | "blankets"
  | "hygieneKits"
  | "medicalKits"
  | "babySupplies";

export type EvacRequestUrgency = "normal" | "urgent" | "critical";

export type EvacRequestLine = {
  id: EvacRequestResourceId;
  label: string;
  quantity: number;
  unit: string;
};

export const EVAC_REQUEST_RESOURCES: {
  id: EvacRequestResourceId;
  label: string;
  unit: string;
  defaultQty: number;
  step: number;
}[] = [
  { id: "foodPacks", label: "Food packs", unit: "packs", defaultQty: 100, step: 10 },
  { id: "waterLiters", label: "Drinking water", unit: "L", defaultQty: 200, step: 50 },
  { id: "blankets", label: "Blankets", unit: "pcs", defaultQty: 50, step: 5 },
  { id: "hygieneKits", label: "Hygiene kits", unit: "kits", defaultQty: 40, step: 5 },
  { id: "medicalKits", label: "Medical kits", unit: "kits", defaultQty: 10, step: 1 },
  { id: "babySupplies", label: "Baby supplies", unit: "kits", defaultQty: 20, step: 5 },
];

function urgencyToPriority(urgency: EvacRequestUrgency): ReportPriority {
  if (urgency === "critical") return "critical";
  if (urgency === "urgent") return "high";
  return "medium";
}

function urgencyLabel(urgency: EvacRequestUrgency): string {
  if (urgency === "critical") return "Critical";
  if (urgency === "urgent") return "Urgent";
  return "Normal";
}

function formatLine(line: EvacRequestLine): string {
  return `${line.quantity} ${line.unit === "L" ? "L" : line.unit} ${line.label.toLowerCase()}`.replace(
    /\s+/g,
    " ",
  );
}

/**
 * Create a queued supply-request incident from the evac resource request form.
 */
export async function createEvacStockRequestReport(input: {
  author: OfficerProfile;
  center: EvacCenter;
  barangay: string;
  lgu: string;
  lines: EvacRequestLine[];
  urgency: EvacRequestUrgency;
  deliveryLocation: string;
  notes?: string;
}): Promise<string> {
  const lines = input.lines.filter((l) => l.quantity > 0);
  if (lines.length === 0) {
    throw new Error("Select at least one resource and set a quantity.");
  }

  const id = newRequestReportId();
  const now = new Date().toISOString();
  const labels = lines.map((l) => {
    if (l.id === "waterLiters") return `${l.quantity} L drinking water`;
    if (l.id === "foodPacks") return `${l.quantity} food packs`;
    if (l.id === "blankets") return `${l.quantity} blankets`;
    if (l.id === "hygieneKits") return `${l.quantity} hygiene kits`;
    if (l.id === "medicalKits") return `${l.quantity} medical kits`;
    if (l.id === "babySupplies") return `${l.quantity} baby supply kits`;
    return formatLine(l);
  });
  const needList =
    labels.length === 1
      ? labels[0]
      : labels.length === 2
        ? `${labels[0]} and ${labels[1]}`
        : `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;

  const delivery =
    input.deliveryLocation.trim() ||
    input.center.name ||
    input.center.locationLabel;
  const extra = input.notes?.trim();

  const notes = [
    `Evacuation center supply request from ${input.center.name}.`,
    `Need ${needList}.`,
    `Urgency: ${urgencyLabel(input.urgency)}.`,
    `Delivery: ${delivery}.`,
    `Occupancy ${input.center.occupancy} / ${input.center.maxCapacity}.`,
    `Condition: ${evacConditionLabel(input.center.condition)}.`,
    extra ? `Notes: ${extra}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const email = input.author.email ?? null;
  const trust = computeReportTrust({
    registered: true,
    idVerified: false,
    email,
    phone: null,
    emailVerified: false,
    mediaSource: "mobile-camera",
    lat: input.center.lat,
    lng: input.center.lng,
    locationAccuracyM: 25,
    aiConfidence: null,
    aiVerdict: null,
  });

  const mediaUrl = "/reports/ec-nangka-elem-after.jpg";
  const priority = urgencyToPriority(input.urgency);

  await setDoc(doc(getClientDb(), "reports", id), {
    citizenUid: input.author.uid,
    citizenName: input.author.displayName || "Officer",
    citizenPurok: input.center.locationLabel || input.center.name,
    barangay: input.barangay,
    lgu: input.lgu,
    citizenPhotoURL: input.author.photoURL ?? null,
    title: `Supply request · ${input.center.name}`,
    notes,
    hazardHint: "evac",
    mediaType: "photo",
    mediaPath: mediaUrl,
    mediaUrl,
    mediaMime: "image/jpeg",
    mediaSource: "mobile-camera",
    lat: input.center.lat,
    lng: input.center.lng,
    locationAccuracyM: 25,
    locationLabel:
      input.center.locationLabel?.trim() ||
      `${input.center.lat.toFixed(5)}, ${input.center.lng.toFixed(5)}`,
    device: "web-ugnai-officer",
    ipAddress: null,
    status: "queued",
    aiVerdict: null,
    aiConfidence: null,
    aiReason: null,
    aiSource: null,
    aiModel: null,
    aiPriority: priority,
    aiPriorityFactors: {
      immediateSeverity: `Evac center request · ${urgencyLabel(input.urgency)}.`,
      peopleAffected: `${input.center.occupancy} on site (cap ${input.center.maxCapacity}).`,
      existingCoverage: "Request raised from on-site stock desk.",
      deliveryFeasibility: `Deliver to ${delivery}.`,
      evidenceQuality: "Officer-filed stock request from evac directory.",
    },
    vertexClass: null,
    vertexConfidence: null,
    vertexLocationLabel: null,
    vertexLocationConfidence: null,
    vertexLocationPlaceId: null,
    vertexLocationPlaceLabel: null,
    validatedAt: null,
    assignees: [],
    investigatorUid: null,
    investigatorName: null,
    investigatedAt: null,
    autoResponderCallAt: null,
    dispatchedAt: null,
    dispatchLog: null,
    manualDispatchChecked: false,
    fieldEvidence: [],
    reporterIdVerified: false,
    reporterEmail: email,
    reporterPhone: null,
    reporterEmailVerified: false,
    trustScore: trust.total,
    trustBreakdown: trust,
    reactionCounts: { ...EMPTY_REACTION_COUNTS },
    commentCount: 0,
    draftStep: null,
    draftIntent: null,
    draftReportFor: null,
    source: "web-auth",
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });

  return id;
}
