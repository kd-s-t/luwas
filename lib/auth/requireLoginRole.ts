import { doc, getDoc } from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import type { UserProfile, UserRole } from "@/lib/auth/types";

const PORTAL_HINT: Record<"citizen" | "officer", string> = {
  citizen:
    "This account is not a citizen. Use Officer login from the role picker.",
  officer:
    "This account is not an officer. Use Citizen login from the role picker.",
};

/**
 * After Auth sign-in, ensure the Firestore profile matches the login portal.
 * Signs out and throws when the role does not match.
 */
export async function requireLoginRole(
  expected: "citizen" | "officer",
  logout: () => Promise<void>,
): Promise<UserProfile> {
  const uid = getClientAuth().currentUser?.uid;
  if (!uid) {
    throw new Error("Sign-in failed.");
  }

  const snap = await getDoc(doc(getClientDb(), "users", uid));
  if (!snap.exists()) {
    await logout();
    throw new Error("Account profile not found. Register first.");
  }

  const profile = snap.data() as UserProfile;
  const role = profile.role as UserRole;
  if (role !== expected) {
    await logout();
    throw new Error(PORTAL_HINT[expected]);
  }

  return profile;
}
