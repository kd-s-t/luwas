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
      `This is a Luwas alert for ${brgy}. ` +
      `${name}${place}, please evacuate now to Consolacion Evacuation Center, ` +
      `or Center 2, or Nangka Elementary. Follow road escape routes. ` +
      `This is an Odette simulation for responders. ` +
      `For emergencies, call local P N P, B F P, or barangay.`
    );
  }
  if (input.priority === "prepare") {
    return (
      `This is a Luwas alert for ${brgy}. ` +
      `${name}${place}, please prepare: stock water, food, and cooking fuel. ` +
      `Watch for flood and wind. This is an Odette simulation. ` +
      `Call local responders if you are in danger.`
    );
  }
  return (
    `This is a Luwas alert for ${brgy}. ` +
    `${name}${place}, please monitor conditions and keep your phone on. ` +
    `This is an Odette simulation. Call local responders if you are in danger.`
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
    "Please stand by for barangay coordination under the Odette simulation.";

  return (
    `This is Luwas M D R R M O for Barangay ${brgy}, ${lgu}. ` +
    `Officer-requested call to ${role}, ${input.stationName}. ` +
    `${reason} ` +
    `This is an Odette simulation for responders. Please acknowledge if you receive this.`
  );
}
