import type { AssistPriority } from "@/lib/ai/assistTypes";
import type { ResponderCallKind } from "@/lib/alerts/responderCall";
import { responderKindLabel } from "@/lib/alerts/responderCall";

/** Short spoken script for Twilio <Say> — keep under ~30s. */
export function buildEvacCallScript(input: {
  ownerName: string;
  purok?: string;
  priority: AssistPriority;
  barangay?: string;
}): string {
  const brgy = input.barangay ?? "Barangay Nangka";
  const name = input.ownerName.trim() || "Resident";
  const place = input.purok ? `, ${input.purok}` : "";

  if (input.priority === "evacuate") {
    return (
      `This is a Ugnai alert for ${brgy}. ` +
      `${name}${place}, please evacuate now to Consolacion Evacuation Center, ` +
      `or Center 2, or Nangka Elementary. Follow road escape routes. ` +
      `This is an Tino simulation for responders. ` +
      `For emergencies, call local P N P, B F P, or barangay.`
    );
  }
  if (input.priority === "prepare") {
    return (
      `This is a Ugnai alert for ${brgy}. ` +
      `${name}${place}, please prepare: stock water, food, and cooking fuel. ` +
      `Watch for flood and wind. This is an Tino simulation. ` +
      `Call local responders if you are in danger.`
    );
  }
  return (
    `This is a Ugnai alert for ${brgy}. ` +
    `${name}${place}, please monitor conditions and keep your phone on. ` +
    `This is an Tino simulation. Call local responders if you are in danger.`
  );
}

/** Spoken script when an investigator is assigned to a citizen report. */
export function buildInvestigatorAssignCallScript(input: {
  ownerName: string;
  barangay?: string;
  title?: string | null;
  hazardHint?: string | null;
}): string {
  const brgy = input.barangay ?? "your barangay";
  const name = input.ownerName.trim() || "Officer";
  const hazard = (input.hazardHint ?? "hazard").replace(/_/g, " ");
  const title = (input.title ?? "a citizen report").slice(0, 60);
  return (
    `This is Ugnai for Barangay ${brgy}. ` +
    `${name}, you were assigned as investigator for a ${hazard} report: ${title}. ` +
    `Open the Ugnai incidents board for evidence and next steps. ` +
    `This is an Tino simulation for responders.`
  );
}

/** Spoken script when MDRRMO dials BFP / PNP / hospital / tanod. */
export function buildResponderCallScript(input: {
  kind: ResponderCallKind;
  stationName: string;
  barangay?: string;
  lgu?: string;
  reason?: string;
}): string {
  const brgy = input.barangay ?? "Nangka";
  const lgu = input.lgu ?? "Consolacion";
  const role = responderKindLabel(input.kind);
  const reason =
    input.reason?.trim() ||
    "Please stand by for barangay coordination under the Tino simulation.";

  return (
    `This is Ugnai M D R R M O for Barangay ${brgy}, ${lgu}. ` +
    `Officer-requested call to ${role}, ${input.stationName}. ` +
    `${reason} ` +
    `This is an Tino simulation for responders. Please acknowledge if you receive this.`
  );
}

/**
 * Auto incident alert (fire / crime / accident) — brief location + situation.
 * Twilio TimeLimit is 55s.
 */
export function buildIncidentAlertCallScript(input: {
  alertLabel: string;
  stationName: string;
  barangay?: string;
  lgu?: string;
  purok?: string | null;
  title?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string {
  const brgy = input.barangay ?? "Nangka";
  const place = input.purok?.trim()
    ? `${input.purok.trim().slice(0, 24)}, ${brgy}`
    : brgy;
  const situation = input.title?.trim()
    ? input.title.trim().slice(0, 40)
    : `${input.alertLabel} reported`;
  const pin =
    typeof input.lat === "number" && typeof input.lng === "number"
      ? ` Pin ${input.lat.toFixed(3)}, ${input.lng.toFixed(3)}.`
      : "";

  return (
    `Ugnai ${input.alertLabel} alert. ${situation} at ${place}.${pin} ` +
    `Please dispatch. Tino simulation.`
  );
}

/** @deprecated Use buildIncidentAlertCallScript */
export function buildFireAlertCallScript(input: {
  stationName: string;
  barangay?: string;
  lgu?: string;
  purok?: string | null;
  title?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string {
  return buildIncidentAlertCallScript({ ...input, alertLabel: "fire" });
}
