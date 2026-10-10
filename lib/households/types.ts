/** Citizen live presence vs their home pin / barangay. */
export type HouseholdPresence = "home" | "away" | "unknown";

export type HouseholdMember = {
  name: string;
  phone?: string;
  email?: string;
  relation?: string;
};

/** Derived for House owners UI from linkedCitizenUids + optional pending flag. */
export type HouseholdAppUserStatus = "none" | "registered" | "pending";

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
  /** Additional people in the house (besides ownerName). */
  members?: HouseholdMember[];
  /** App citizen accounts linked to this roster row. */
  linkedCitizenUids?: string[];
  /** Officer app accounts who live at / are tied to this house. */
  linkedOfficerUids?: string[];
  /** Optional barangay label for scoped matching. */
  barangay?: string | null;
  lgu?: string | null;
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
  members?: HouseholdMember[];
  barangay?: string;
  lgu?: string;
};

export function householdAppUserStatus(
  h: Pick<Household, "linkedCitizenUids" | "email">,
  pendingUidCount = 0,
  /** Optional: barangay citizen emails already registered in the app. */
  registeredEmails?: Set<string>,
): HouseholdAppUserStatus {
  const linked = h.linkedCitizenUids?.filter(Boolean).length ?? 0;
  if (linked > 0) return "registered";
  const email = h.email?.trim().toLowerCase();
  if (email && registeredEmails?.has(email)) return "registered";
  if (pendingUidCount > 0) return "pending";
  return "none";
}
