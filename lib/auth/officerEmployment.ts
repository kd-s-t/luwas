import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { officerScopeBarangay } from "@/lib/auth/accountValidation";
import type { EmploymentEvent, OfficerProfile } from "@/lib/auth/types";
import { hasCaptainRole, isBarangayCaptain } from "@/lib/auth/types";
import { getClientDb, getSecondaryAuth } from "@/lib/firebase/client";
import type { Household } from "@/lib/households/types";

export type HireOfficerInput = {
  email: string;
  password: string;
  displayName: string;
  /** e.g. MDRRMO Focal, Tanod, Secretary */
  title: string;
  orgName?: string;
};

export type AddExistingOfficerInput = {
  household: Household;
  title: string;
  password: string;
};

function mapAuthError(err: unknown): Error {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  const message = err instanceof Error ? err.message : "Hire failed";
  if (code === "auth/email-already-in-use") {
    return new Error("That email already has an account.");
  }
  if (code === "auth/weak-password") {
    return new Error("Password must be at least 6 characters.");
  }
  return err instanceof Error ? err : new Error(message);
}

async function writeOfficerProfile(opts: {
  uid: string;
  email: string;
  displayName: string;
  orgName: string;
  title: string;
  barangay: string;
  lgu: string;
  areaId: string;
  captain: OfficerProfile;
  merge: boolean;
}): Promise<void> {
  const now = new Date().toISOString();
  const event: EmploymentEvent = {
    at: now,
    byUid: opts.captain.uid,
    byName: opts.captain.displayName,
    action: "hired",
    title: opts.title,
  };
  const payload = {
    uid: opts.uid,
    email: opts.email,
    displayName: opts.displayName,
    orgName: opts.orgName,
    role: "officer" as const,
    createdAt: now,
    accountStatus: "active" as const,
    officerRank: "officer" as const,
    officerTitle: opts.title,
    barangay: opts.barangay,
    lgu: opts.lgu,
    areaId: opts.areaId,
    activeBarangayId: opts.areaId,
    hiredAt: now,
    hiredByUid: opts.captain.uid,
    firedAt: null,
    firedByUid: null,
    firedReason: null,
    employmentHistory: arrayUnion(event),
    idVerified: true,
    idType: null,
    idConfidence: null,
    idReason: "Added by barangay captain from house owner",
    idVerifiedAt: now,
    idSource: "local" as const,
    photoURL: null,
    idDocumentPath: null,
    faceDocumentPath: null,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
    ...(opts.merge ? {} : { createdAtServer: serverTimestamp() }),
  };
  await setDoc(doc(getClientDb(), "users", opts.uid), payload, {
    merge: opts.merge,
  });
}

async function linkHouseholdOfficer(
  householdId: string,
  officerUid: string,
): Promise<void> {
  const { getDoc } = await import("firebase/firestore");
  const ref = doc(getClientDb(), "households", householdId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const linked = Array.isArray(data.linkedOfficerUids)
    ? data.linkedOfficerUids.map(String)
    : [];
  if (linked.includes(officerUid)) return;
  await updateDoc(ref, {
    linkedOfficerUids: [...linked, officerUid],
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  });
}

/** Captain registers a new officer for this barangay (active immediately). */
export async function hireOfficerByCaptain(
  captain: OfficerProfile,
  input: HireOfficerInput,
): Promise<{ uid: string }> {
  if (!isBarangayCaptain(captain)) {
    throw new Error("Only the barangay captain can hire officers.");
  }
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();
  const title = input.title.trim();
  const password = input.password;
  if (!email || !displayName || !title || password.length < 6) {
    throw new Error("Name, title, email, and password (6+) are required.");
  }

  const barangay = officerScopeBarangay(captain);
  const lgu = captain.lgu?.trim() || "Consolacion";
  const areaId =
    (captain.areaId ?? captain.activeBarangayId)?.trim() ||
    "consolacion/nangka";
  const orgName =
    input.orgName?.trim() || `Brgy. ${barangay} · ${title}`;

  const secondary = getSecondaryAuth();
  try {
    const cred = await createUserWithEmailAndPassword(
      secondary,
      email,
      password,
    );
    await updateProfile(cred.user, { displayName });
    await writeOfficerProfile({
      uid: cred.user.uid,
      email,
      displayName,
      orgName,
      title,
      barangay,
      lgu,
      areaId,
      captain,
      merge: false,
    });
    await signOut(secondary);
    return { uid: cred.user.uid };
  } catch (err) {
    try {
      await signOut(secondary);
    } catch {
      /* ignore */
    }
    throw mapAuthError(err);
  }
}

/**
 * Promote a house owner into an officer login (or re-activate if Auth exists).
 * Links the officer uid onto that household.
 */
export async function addExistingOfficerFromHousehold(
  captain: OfficerProfile,
  input: AddExistingOfficerInput,
): Promise<{ uid: string }> {
  if (!isBarangayCaptain(captain)) {
    throw new Error("Only the barangay captain can add officers.");
  }
  const h = input.household;
  const email = h.email.trim().toLowerCase();
  const displayName = h.ownerName.trim();
  const title = input.title.trim();
  const password = input.password;
  if (!email) {
    throw new Error("That house owner needs an email before they can log in.");
  }
  if (!displayName || !title || password.length < 6) {
    throw new Error("Title and password (6+) are required.");
  }

  const barangay = officerScopeBarangay(captain);
  const lgu = captain.lgu?.trim() || "Consolacion";
  const areaId =
    (captain.areaId ?? captain.activeBarangayId)?.trim() ||
    "consolacion/nangka";
  const orgName = `Brgy. ${barangay} · ${title}`;

  // Already an active officer?
  const existingUsers = await getDocs(
    query(
      collection(getClientDb(), "users"),
      where("email", "==", email),
    ),
  );
  if (!existingUsers.empty) {
    const d = existingUsers.docs[0]!;
    const data = d.data();
    if (data.role === "officer" && data.accountStatus !== "fired") {
      await linkHouseholdOfficer(h.id, d.id);
      return { uid: d.id };
    }
    if (data.role === "citizen") {
      throw new Error(
        "That email is a citizen account. Use Hire officer with a different staff email, or register them separately.",
      );
    }
    // Re-hire fired officer
    if (data.role === "officer" && data.accountStatus === "fired") {
      const now = new Date().toISOString();
      await updateDoc(doc(getClientDb(), "users", d.id), {
        accountStatus: "active",
        officerTitle: title,
        orgName,
        barangay,
        lgu,
        areaId,
        activeBarangayId: areaId,
        firedAt: null,
        firedByUid: null,
        firedReason: null,
        hiredAt: now,
        hiredByUid: captain.uid,
        employmentHistory: arrayUnion({
          at: now,
          byUid: captain.uid,
          byName: captain.displayName,
          action: "hired",
          title,
        }),
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
      });
      await linkHouseholdOfficer(h.id, d.id);
      return { uid: d.id };
    }
  }

  const secondary = getSecondaryAuth();
  try {
    let uid: string;
    try {
      const cred = await createUserWithEmailAndPassword(
        secondary,
        email,
        password,
      );
      uid = cred.user.uid;
      await updateProfile(cred.user, { displayName });
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      if (code !== "auth/email-already-in-use") throw err;
      const cred = await signInWithEmailAndPassword(
        secondary,
        email,
        password,
      );
      uid = cred.user.uid;
    }

    await writeOfficerProfile({
      uid,
      email,
      displayName,
      orgName,
      title,
      barangay,
      lgu,
      areaId,
      captain,
      merge: true,
    });
    await linkHouseholdOfficer(h.id, uid);
    await signOut(secondary);
    return { uid };
  } catch (err) {
    try {
      await signOut(secondary);
    } catch {
      /* ignore */
    }
    throw mapAuthError(err);
  }
}

/** Soft-remove officer — account stays for history; no longer active. */
export async function fireOfficerByCaptain(
  captain: OfficerProfile,
  target: OfficerProfile,
  reason?: string,
): Promise<void> {
  if (!isBarangayCaptain(captain)) {
    throw new Error("Only the barangay captain can fire officers.");
  }
  if (target.role !== "officer") {
    throw new Error("Only officers can be fired from staff.");
  }
  if (target.uid === captain.uid) {
    throw new Error("You cannot fire yourself.");
  }
  if (hasCaptainRole(target)) {
    throw new Error("Cannot fire the barangay captain.");
  }
  if (target.accountStatus === "fired") {
    throw new Error("This officer is already removed.");
  }

  const now = new Date().toISOString();
  const note = reason?.trim() || "Removed from barangay staff";
  const event: EmploymentEvent = {
    at: now,
    byUid: captain.uid,
    byName: captain.displayName,
    action: "fired",
    reason: note,
    title: target.officerTitle ?? undefined,
  };

  await updateDoc(doc(getClientDb(), "users", target.uid), {
    accountStatus: "fired",
    activeBarangayId: null,
    firedAt: now,
    firedByUid: captain.uid,
    firedReason: note,
    employmentHistory: arrayUnion(event),
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  });
}
