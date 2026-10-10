import type { AssistPriority } from "@/lib/ai/assistTypes";
import type { BrandedEmailParts } from "@/lib/email/branded";
import {
  buildEvacuateAlertEmail,
  buildPrepareAlertEmail,
  DEFAULT_EMAIL_SAMPLE,
  type EmailSampleContext,
} from "@/lib/email/templates";

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

/** Branded HTML+text email — not the SMS string. */
export function buildEvacEmailParts(input: {
  ownerName: string;
  email?: string;
  purok?: string;
  priority: AssistPriority;
  barangay?: string;
}): BrandedEmailParts {
  const ctx: EmailSampleContext = {
    ...DEFAULT_EMAIL_SAMPLE,
    name: input.ownerName.trim() || "Resident",
    email: input.email?.trim() || DEFAULT_EMAIL_SAMPLE.email,
    barangay: input.barangay ?? DEFAULT_EMAIL_SAMPLE.barangay,
    purok: input.purok?.trim() || DEFAULT_EMAIL_SAMPLE.purok,
  };

  if (input.priority === "evacuate") {
    return buildEvacuateAlertEmail(ctx);
  }
  if (input.priority === "prepare") {
    return buildPrepareAlertEmail(ctx);
  }

  // Monitor — reuse prepare chrome with softer copy.
  const prepare = buildPrepareAlertEmail(ctx);
  return {
    ...prepare,
    subject: buildEvacEmailSubject({
      priority: "monitor",
      barangay: ctx.barangay,
    }),
    text: prepare.text.replace("PREPARE —", "MONITOR —"),
  };
}

/** @deprecated Prefer buildEvacEmailParts — kept for plain-text fallbacks. */
export function buildEvacEmailBody(input: {
  ownerName: string;
  purok?: string;
  priority: AssistPriority;
  barangay?: string;
}): string {
  return buildEvacEmailParts(input).text;
}

export function isValidAlertEmail(value: string | undefined | null): boolean {
  const e = value?.trim() ?? "";
  if (!e || e.length > 200) return false;
  // Synthetic roster may use *.demo addresses — still valid for simulation sends.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}
