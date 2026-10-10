import type { ReportHazardHint, ReportMediaType } from "@/lib/reports/types";

export type ValidationVerdict = {
  verdict: "legit" | "rejected" | "needs_review";
  confidence: number;
  reason: string;
  source: "local";
};

/** Deterministic validator when Gemini is unavailable. */
export function runLocalValidate(input: {
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  mediaType: ReportMediaType;
  mediaMime: string;
  fileName?: string;
}): ValidationVerdict {
  const text = `${input.title} ${input.notes} ${input.fileName ?? ""}`.toLowerCase();

  const spam =
    /\b(test|fake|joke|photoshop|ai generated|clickbait|meme)\b/i.test(text);
  const hazardWords =
    /\b(flood|baha|landslide|guho|typhoon|bagyo|fire|sunog|evacuate|tubig|slippery|overflow|evacuation center|evac|occupancy|sheltered|capacity)\b/i.test(
      text,
    );
  const placeWords =
    /\b(nangka|consolacion|purok|cebu|barangay|brgy)\b/i.test(text);

  if (spam && !hazardWords) {
    return {
      verdict: "rejected",
      confidence: 0.72,
      reason:
        "Local rules flagged likely non-hazard / test content. Officer review still available.",
      source: "local",
    };
  }

  if (hazardWords && (placeWords || input.hazardHint !== "other")) {
    return {
      verdict: "legit",
      confidence: 0.68,
      reason: `Local rules: hazard language matches ${input.hazardHint} report with ${input.mediaType} evidence. Queue for officer confirmation if needed.`,
      source: "local",
    };
  }

  if (hazardWords) {
    return {
      verdict: "needs_review",
      confidence: 0.55,
      reason:
        "Hazard terms present but location cues are weak — held for officer review.",
      source: "local",
    };
  }

  return {
    verdict: "needs_review",
    confidence: 0.45,
    reason:
      "Insufficient signal to auto-accept or reject. Kept in AI validation queue for officers.",
    source: "local",
  };
}
