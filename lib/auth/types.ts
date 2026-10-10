import type { AcceptedIdType } from "@/lib/auth/idTypes";

export type UserRole = "officer" | "citizen";

/** pending = awaits officer validation; fired = removed by captain (history kept). */
export type AccountStatus = "pending" | "active" | "rejected" | "fired";

/** Captain / staff rank on officer profiles. */
export type OfficerRank = "captain" | "officer";

export type EmploymentEvent = {
  at: string;
  byUid: string;
  byName: string;
  action: "hired" | "fired";
  reason?: string;
  title?: string;
};

type IdFields = {
  /** Optional avatar URL; UI falls back to initials. */
  photoURL?: string | null;
  idVerified?: boolean;
  idType?: AcceptedIdType | null;
  idConfidence?: number | null;
  idReason?: string | null;
  idVerifiedAt?: string | null;
  idSource?: "gemini" | "local" | null;
  idDocumentPath?: string | null;
  faceDocumentPath?: string | null;
};

type PlaceFields = {
  accountStatus?: AccountStatus;
  barangay?: string | null;
  lgu?: string | null;
  areaId?: string | null;
};

export type OfficerProfile = {
  uid: string;
  email: string;
  displayName: string;
  orgName: string;
  role: "officer";
  createdAt: string;
  /** Active onboarded barangay area id (e.g. consolacion/nangka). */
  activeBarangayId?: string | null;
  officerRank?: OfficerRank;
  /** Job title e.g. MDRRMO Focal, Tanod. */
  officerTitle?: string | null;
  /** Staff directory id (secretary, mdrrmo, tanod-1, …). */
  staffId?: string | null;
  /** Parent staff id for pyramid (matches NANGKA_STAFF_SEED). */
  reportsToStaffId?: string | null;
  /** Org-chart rank label from staff seed. */
  staffRank?: string | null;
  hiredAt?: string | null;
  hiredByUid?: string | null;
  firedAt?: string | null;
  firedByUid?: string | null;
  firedReason?: string | null;
  /** Soft-remove history — never delete the user doc. */
  employmentHistory?: EmploymentEvent[];
} & IdFields &
  PlaceFields;

export type CitizenProfile = {
  uid: string;
  email: string;
  displayName: string;
  purok: string;
  phone: string;
  role: "citizen";
  createdAt: string;
  /** Linked house-owner roster row when matched/validated. */
  householdId?: string | null;
} & IdFields &
  PlaceFields;

export type UserProfile = OfficerProfile | CitizenProfile;

export function isOfficer(
  profile: UserProfile | null | undefined,
): profile is OfficerProfile {
  return profile?.role === "officer";
}

export function isCitizen(
  profile: UserProfile | null | undefined,
): profile is CitizenProfile {
  return profile?.role === "citizen";
}

/** Legacy profiles without accountStatus are treated as active. */
export function isAccountActive(
  profile: UserProfile | null | undefined,
): boolean {
  if (!profile) return false;
  const status = profile.accountStatus;
  return status == null || status === "active";
}

export function isAccountPending(
  profile: UserProfile | null | undefined,
): boolean {
  return profile?.accountStatus === "pending";
}

export function isAccountFired(
  profile: UserProfile | null | undefined,
): boolean {
  return profile?.accountStatus === "fired";
}

/** Profile looks like Punong Barangay (rank / org / demo email). */
export function hasCaptainRole(
  profile: UserProfile | null | undefined,
): boolean {
  if (!isOfficer(profile)) return false;
  if (profile.officerRank === "captain") return true;
  const org = profile.orgName.toLowerCase();
  if (org.includes("punong") || /\bcaptain\b/.test(org)) return true;
  if (profile.email.trim().toLowerCase().startsWith("captain@")) return true;
  return false;
}

/** Active Punong Barangay who can hire / fire staff. */
export function isBarangayCaptain(
  profile: UserProfile | null | undefined,
): profile is OfficerProfile {
  return (
    isOfficer(profile) &&
    isAccountActive(profile) &&
    hasCaptainRole(profile)
  );
}
