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
  createdAt: string;
  updatedAt: string;
};
