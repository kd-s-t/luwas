import type { AssistPriority } from "@/lib/ai/assistTypes";
import { buildEvacSmsBody } from "@/lib/alerts/smsCopy";

export function buildEvacEmailSubject(input: {
  priority: AssistPriority;
  barangay?: string;
}): string {
  const brgy = input.barangay ?? "Brgy. Nangka";
  const label =
    input.priority === "evacuate"
      ? "EVACUATE NOW"
      : input.priority === "prepare"
        ? "PREPARE"
        : "MONITOR";
  return `LUWAS ALERT · ${brgy} · ${label}`;
}

export function buildEvacEmailBody(input: {
  ownerName: string;
  purok?: string;
  priority: AssistPriority;
  barangay?: string;
}): string {
  const sms = buildEvacSmsBody(input);
  if (input.priority === "evacuate") {
    return (
      `${sms}\n\n` +
      `If you are on higher ground and barangay advises shelter-in-place, stock drinking water, ready-to-eat food, and safe cooking fuel instead of traveling through flood water.\n\n` +
      `— Luwas · Odette DRRM simulation (responder guidance)`
    );
  }
  if (input.priority === "prepare") {
    return (
      `${sms}\n\n` +
      `Recommended stocks: drinking water, ready-to-eat food (3 days), cooking fuel / fire source, medicines, power bank, flashlight.\n\n` +
      `— Luwas · Odette DRRM simulation (responder guidance)`
    );
  }
  return `${sms}\n\n— Luwas · Odette DRRM simulation (responder guidance)`;
}

export function isValidAlertEmail(value: string | undefined | null): boolean {
  const e = value?.trim() ?? "";
  if (!e || e.length > 200) return false;
  // Synthetic roster may use *.demo addresses — still valid for simulation sends.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
