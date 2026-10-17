import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import type { OfficerProfile } from "@/lib/auth/types";
import { getClientDb } from "@/lib/firebase/client";
import {
  evacConditionLabel,
  evacStockLines,
  type EvacCenter,
} from "@/lib/evacCenters/types";
import { newRequestReportId } from "@/lib/reports/reportId";
import { EMPTY_REACTION_COUNTS } from "@/lib/reports/socialTypes";
import { computeReportTrust } from "@/lib/reports/trustScore";

/**
 * Create a queued incident from an evac center's on-site stock quantities
 * (food / water / blankets / medical kits) as a supply request.
 */
export async function createEvacStockRequestReport(input: {
  author: OfficerProfile;
  center: EvacCenter;
  barangay: string;
  lgu: string;
}): Promise<string> {
  const lines = evacStockLines(input.center.stock);
  if (lines.length === 0) {
    throw new Error("Set at least one supply quantity to request.");
  }

  const id = newRequestReportId();
  const now = new Date().toISOString();
  const needList =
    lines.length === 1
      ? lines[0]
      : lines.length === 2
        ? `${lines[0]} and ${lines[1]}`
        : `${lines.slice(0, -1).join(", ")}, and ${lines[lines.length - 1]}`;

  const notes = [
    `Evacuation center supply request from ${input.center.name}.`,
    `Need ${needList}.`,
    `Occupancy ${input.center.occupancy} / ${input.center.maxCapacity}.`,
    `Condition: ${evacConditionLabel(input.center.condition)}.`,
  ].join(" ");

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
    aiPriority: "high",
    aiPriorityFactors: {
      immediateSeverity: "Evac center requested relief supplies.",
      peopleAffected: `${input.center.occupancy} on site (cap ${input.center.maxCapacity}).`,
      existingCoverage: "Request raised from on-site stock desk.",
      deliveryFeasibility: "Confirm road access to shelter.",
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
