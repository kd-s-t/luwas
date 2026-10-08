import type { AssistPriority } from "@/lib/ai/assistTypes";

export function buildEvacSmsBody(input: {
  ownerName: string;
  purok?: string;
  priority: AssistPriority;
  barangay?: string;
}): string {
  const brgy = input.barangay ?? "Brgy. Nangka";
  const place = input.purok ? ` (${input.purok})` : "";
  const name = input.ownerName.trim() || "Resident";

  if (input.priority === "evacuate") {
    return (
      `LUWAS ALERT · ${brgy}: ${name}${place}, please EVACUATE now to the nearest barangay safe point / hall. ` +
      `Follow road escape routes. This is guidance for responders — not a life-safety guarantee. ` +
      `For emergencies call local PNP/BFP/barangay.`
    );
  }
  if (input.priority === "prepare") {
    return (
      `LUWAS ALERT · ${brgy}: ${name}${place}, please PREPARE to evacuate — pack essentials, watch flood/wind, ` +
      `await barangay instructions. Guidance only — call local responders if in danger.`
    );
  }
  return (
    `LUWAS ALERT · ${brgy}: ${name}${place}, stay on MONITOR — check welfare and keep phone on. ` +
    `Guidance only — call local responders if in danger.`
  );
}
