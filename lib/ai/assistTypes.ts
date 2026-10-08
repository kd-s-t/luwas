export type AssistPriority = "evacuate" | "prepare" | "monitor";

export type AssistHouseholdAction = {
  householdId: string;
  priority: AssistPriority;
  reason: string;
  /** Filled from roster so officers can call without leaving chat. */
  ownerName?: string;
  phone?: string;
  purok?: string;
};

/** Suggested escape path from a priority household to a safe point. */
export type AssistEscapeRoute = {
  householdId: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  destinationId: string;
  destinationName: string;
  bearing: number;
  direction: string;
  distanceKm: number;
  instruction: string;
  /** Road-following polyline (OSM/OSRM). Empty until enriched. */
  path: { lat: number; lng: number }[];
  /** True when path follows streets (not crow-flies). */
  routed: boolean;
};

export type AssistResult = {
  summary: string;
  focusHazard: "flood" | "landslide" | "typhoon" | "earthquake" | "weather" | "mixed";
  actions: AssistHouseholdAction[];
  escapes: AssistEscapeRoute[];
  mapHint: string;
  source: "gemini" | "local";
  /** Google model id when source is gemini */
  model?: string;
};
