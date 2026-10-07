import type { AcceptedIdType } from "@/lib/auth/idTypes";

export type UserRole = "officer" | "citizen";

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

export type OfficerProfile = {
  uid: string;
  email: string;
  displayName: string;
  orgName: string;
  role: "officer";
  createdAt: string;
} & IdFields;

export type CitizenProfile = {
  uid: string;
  email: string;
  displayName: string;
  purok: string;
  phone: string;
  role: "citizen";
  createdAt: string;
} & IdFields;

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
