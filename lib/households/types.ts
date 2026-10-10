/** Citizen live presence vs their home pin / barangay. */
export type HouseholdPresence = "home" | "away" | "unknown";

export type Household = {
  id: string;
  ownerName: string;
  address: string;
  purok: string;
  phone: string;
  email: string;
  notes: string;
  /** Home pin (structure) — does not move when citizen travels. */
  lat: number | null;
  lng: number | null;
  officerUid: string;
  orgName: string;
  createdAt: string;
  /** ISO timestamp — same as createdAt until a household is edited. */
  updatedAt: string;
  /** At home vs currently located outside the home barangay. */
  presence?: HouseholdPresence;
  /** Last citizen GPS (may be away from home pin). */
  lastSeenLat?: number | null;
  lastSeenLng?: number | null;
  /** Resolved place label e.g. "Brgy. Mabolo, Cebu City". */
  lastSeenArea?: string | null;
  lastSeenAt?: string | null;
};

export type HouseholdInput = {
  ownerName: string;
  address: string;
  purok: string;
  phone: string;
  email: string;
  notes: string;
  lat?: number;
  lng?: number;
};
