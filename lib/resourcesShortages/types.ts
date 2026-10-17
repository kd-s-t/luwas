import type { SupplyNeedKind } from "@/lib/workspace/reportNeed";
import type { AllocationOption } from "@/lib/workspace/allocationOptions";

/** Cached Gemini allocation draft on the shortage doc. */
export type ShortageAllocationDraft = {
  planKey: string;
  options: AllocationOption[];
  source: "gemini" | "local";
  prompt: string | null;
  raw: string | null;
  model: string | null;
  error: string | null;
  savedAt: string;
};

/** Parent shortage record. Doc id is the public code (e.g. RS-001). */
export type ResourceShortage = {
  id: string;
  kind: SupplyNeedKind;
  resourceLabel: string;
  resourceBlurb: string;
  totalNeededL: number;
  availableL: number;
  shortageL: number;
  communityCount: number;
  advisory: string;
  reportIds: string[];
  primaryReportId: string;
  compareHref: string;
  /** Persisted compare-options draft (prompt + return) so Gemini is not re-run. */
  allocation: ShortageAllocationDraft | null;
  /** Selected option id from compare (e.g. feasible | even | need). */
  selectedOptionId: string | null;
  /** review_draft | approved */
  reviewStatus: "review_draft" | "approved" | null;
  /**
   * Allocation plan stepper progress so officers can continue later.
   * 1 compare · 2 review & approve · 3 track delivery
   */
  workflowStep: 1 | 2 | 3 | null;
  createdAt: string;
  updatedAt: string;
};

export function hrefForShortageWorkflow(
  shortageId: string,
  step: 1 | 2 | 3 | null | undefined,
): string {
  const id = shortageId.trim().toUpperCase();
  if (!id) return "/admin/resources";
  if (step === 3) {
    return `/admin/resources/track/${encodeURIComponent(id)}`;
  }
  if (step === 2) {
    return `/admin/resources/review/${encodeURIComponent(id)}`;
  }
  return `/admin/resources/compare/${encodeURIComponent(id)}`;
}

export function hrefForShortageDesk(shortageId: string): string {
  const id = shortageId.trim().toUpperCase();
  if (!id) return "/admin/resources";
  return `/admin/resources/${encodeURIComponent(id)}`;
}
