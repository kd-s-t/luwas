export type ResourceSuggestionReadiness =
  | "ready"
  | "access_unknown"
  | "no_transport";

/** One sitio request nested under a suggestion plan doc. */
export type ResourceSuggestionRequest = {
  community: string;
  barangayLabel: string;
  reportId: string;
  reportIds: string[];
  people: number;
  needL: number;
  localStockL: number;
  gapL: number;
  suggestedAllocateL: number;
  readiness: ResourceSuggestionReadiness;
  readinessLabel: string;
  mediaUrl: string | null;
  lat: number | null;
  lng: number | null;
};

/**
 * One Firestore doc per shortage plan (id = RS-001).
 * All sitio requests for that plan live in `requests`.
 */
export type ResourceSuggestion = {
  id: string;
  shortageId: string;
  epicCode: string;
  kind: string;
  resourceLabel: string;
  totalNeededL: number;
  availableL: number;
  shortageL: number;
  requestCount: number;
  requests: ResourceSuggestionRequest[];
  createdAt: string;
  updatedAt: string;
};
