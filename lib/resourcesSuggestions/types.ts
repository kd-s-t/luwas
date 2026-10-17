export type ResourceSuggestionReadiness =
  | "ready"
  | "access_unknown"
  | "no_transport";

export type ResourceSuggestion = {
  id: string;
  /** Firestore doc id on resources_shortages (e.g. RS-001). */
  shortageId: string;
  /** Same as shortageId; kept for query compatibility. */
  epicCode: string;
  kind: string;
  community: string;
  barangayLabel: string;
  reportId: string;
  reportIds: string[];
  people: number;
  needL: number;
  localStockL: number;
  gapL: number;
  /** Suggested warehouse liters for this sitio. */
  suggestedAllocateL: number;
  readiness: ResourceSuggestionReadiness;
  readinessLabel: string;
  mediaUrl: string | null;
  lat: number | null;
  lng: number | null;
  createdAt: string;
  updatedAt: string;
};
