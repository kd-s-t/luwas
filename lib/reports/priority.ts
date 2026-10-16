import type {
  ReportHazardHint,
  ReportPriority,
  ReportPriorityFactors,
} from "@/lib/reports/types";

const PRIORITIES: ReportPriority[] = [
  "critical",
  "high",
  "medium",
  "low",
];

export function parseReportPriority(
  value: unknown,
): ReportPriority | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return PRIORITIES.includes(v as ReportPriority)
    ? (v as ReportPriority)
    : null;
}

export function parsePriorityFactors(
  raw: unknown,
): ReportPriorityFactors | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const pick = (key: keyof ReportPriorityFactors) => {
    const v = row[key];
    return typeof v === "string" && v.trim() ? v.trim() : "";
  };
  const factors: ReportPriorityFactors = {
    immediateSeverity: pick("immediateSeverity"),
    peopleAffected: pick("peopleAffected"),
    existingCoverage: pick("existingCoverage"),
    deliveryFeasibility: pick("deliveryFeasibility"),
    evidenceQuality: pick("evidenceQuality"),
  };
  if (
    !factors.immediateSeverity &&
    !factors.peopleAffected &&
    !factors.existingCoverage &&
    !factors.deliveryFeasibility &&
    !factors.evidenceQuality
  ) {
    return null;
  }
  return factors;
}

/** Deterministic priority when Gemini is unavailable. */
export function localPriorityForReport(input: {
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  verdict: "legit" | "rejected" | "needs_review";
}): { priority: ReportPriority; factors: ReportPriorityFactors } {
  const text = `${input.title} ${input.notes}`.toLowerCase();
  const lifeSafety =
    /\b(trap(ped)?|drown|rescue|sos|casualt|injur|missing|buried|collaps|fire|sunog|life.?threat)\b/i.test(
      text,
    ) ||
    input.hazardHint === "fire" ||
    input.hazardHint === "landslide";
  const manyPeople =
    /\b(\d{2,}|hundred|dozens|households?|families|evacuees|occupancy)\b/i.test(
      text,
    );
  const accessHard =
    /\b(impassable|no access|cut off|stranded|boat|deep water|road block)\b/i.test(
      text,
    );

  let priority: ReportPriority = "medium";
  if (input.verdict === "rejected") {
    priority = "low";
  } else if (lifeSafety && (manyPeople || accessHard)) {
    priority = "critical";
  } else if (lifeSafety || manyPeople) {
    priority = "high";
  } else if (input.verdict === "needs_review") {
    priority = "medium";
  } else {
    priority = "low";
  }

  return {
    priority,
    factors: {
      immediateSeverity: lifeSafety
        ? "Life-safety or acute hazard language present."
        : "No clear life-safety signal in the claim.",
      peopleAffected: manyPeople
        ? "Multiple households or large group indicated."
        : "People count unclear or limited.",
      existingCoverage:
        "Local stock not checked in this pass — confirm on Resources.",
      deliveryFeasibility: accessHard
        ? "Access may be constrained; confirm route before dispatch."
        : "No strong access blockers stated.",
      evidenceQuality:
        input.verdict === "legit"
          ? "Claim accepted with available evidence."
          : input.verdict === "needs_review"
            ? "Evidence incomplete or conflicting — human review."
            : "Claim rejected or weak evidence.",
    },
  };
}

export const PRIORITY_RANK: Record<ReportPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};
