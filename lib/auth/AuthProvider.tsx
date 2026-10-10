"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { AcceptedIdType } from "@/lib/auth/idTypes";
import { getClientAuth, getClientDb, useEmulators } from "@/lib/firebase/client";
import { isFirstActiveOfficerInBarangay } from "@/lib/auth/accountValidation";
import type {
  CitizenProfile,
  OfficerProfile,
  UserProfile,
} from "@/lib/auth/types";
import {
  findMatchingHousehold,
  linkCitizenToHousehold,
} from "@/lib/households/match";
import { hydrateOnboardedBarangays } from "@/lib/onboarding/storage";
import {
  getPreferredAreaId,
  setPreferredAreaId,
} from "@/lib/onboarding/types";

function mapAuthError(err: unknown): Error {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  const message = err instanceof Error ? err.message : "Authentication failed";

  if (
    code === "auth/network-request-failed" ||
    message.includes("network-request-failed")
  ) {
    if (useEmulators) {
      return new Error(
        "Cannot reach Firebase Auth emulator (127.0.0.1:9099). Start it with: npm run emulators (requires Java 21+).",
      );
    }
    return new Error("Network error reaching Firebase Auth. Check your connection.");
  }

  return err instanceof Error ? err : new Error(message);
}

export type RegisterIdProof = {
  idVerified: boolean;
  idType: AcceptedIdType | null;
  idConfidence: number | null;
  idReason: string | null;
  idSource: "gemini" | "local" | null;
  photoURL?: string | null;
  idDocumentPath?: string | null;
  faceDocumentPath?: string | null;
};

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    displayName: string;
    orgName: string;
    idProof: RegisterIdProof;
    areaId: string;
    barangay: string;
    lgu: string;
  }) => Promise<{ accountStatus: "pending" | "active" }>;
  registerCitizen: (input: {
    email: string;
    password: string;
    displayName: string;
    purok: string;
    phone: string;
    idProof: RegisterIdProof;
    areaId: string;
    barangay: string;
    lgu: string;
  }) => Promise<{ autoValidated: boolean; householdId: string | null }>;
  logout: () => Promise<void>;
  /** Refresh profile from Firestore (e.g. after onboarding updates). */
  refreshProfile: () => Promise<void>;
  setActiveBarangay: (
    areaId: string,
    orgName?: string,
  ) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function idProofFields(proof: RegisterIdProof) {
  return {
    idVerified: proof.idVerified,
    idType: proof.idType,
    idConfidence: proof.idConfidence,
    idReason: proof.idReason,
    idVerifiedAt: proof.idVerified
      ? new Date().toISOString()
      : null,
    idSource: proof.idSource,
    photoURL: proof.photoURL ?? null,
    idDocumentPath: proof.idDocumentPath ?? null,
    faceDocumentPath: proof.faceDocumentPath ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      const auth = getClientAuth();
      unsub = onAuthStateChanged(auth, async (nextUser) => {
        setUser(nextUser);
        if (!nextUser) {
          setProfile(null);
          setLoading(false);
          return;
        }

        try {
          const snap = await getDoc(doc(getClientDb(), "users", nextUser.uid));
          if (snap.exists()) {
            const nextProfile = snap.data() as UserProfile;
            setProfile(nextProfile);
            if (nextProfile.role === "officer") {
              void hydrateOnboardedBarangays().then(() => {
                const active = nextProfile.activeBarangayId;
                if (active && !getPreferredAreaId()) {
                  setPreferredAreaId(active);
                }
              });
            }
          } else {
            setProfile(null);
          }
        } catch {
          setProfile(null);
        } finally {
          setLoading(false);
        }
      });
    } catch (err) {
      console.error("[luwas] Firebase Auth failed to initialize", err);
      setUser(null);
      setProfile(null);
      setLoading(false);
    }

    return () => unsub?.();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(getClientAuth(), email, password);
    } catch (err) {
      throw mapAuthError(err);
    }
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName: string;
      orgName: string;
      idProof: RegisterIdProof;
      areaId: string;
      barangay: string;
      lgu: string;
    }) => {
      if (!input.idProof.idVerified) {
        throw new Error("ID verification required before registration.");
      }
      if (!input.areaId.trim() || !input.barangay.trim()) {
        throw new Error("Choose your barangay / location to continue.");
      }
      try {
        const cred = await createUserWithEmailAndPassword(
          getClientAuth(),
          input.email,
          input.password,
        );
        await updateProfile(cred.user, {
          displayName: input.displayName,
          photoURL: input.idProof.photoURL ?? undefined,
        });

        const emailNorm = input.email.trim().toLowerCase();
        const orgLower = input.orgName.toLowerCase();
        const looksCaptain =
          emailNorm.startsWith("captain@") ||
          orgLower.includes("punong") ||
          /\bcaptain\b/.test(orgLower);

        // Write pending first so we are signed-in for the peer check.
        const base: OfficerProfile = {
          uid: cred.user.uid,
          email: emailNorm,
          displayName: input.displayName,
          orgName: input.orgName,
          role: "officer",
          createdAt: new Date().toISOString(),
          accountStatus: "pending",
          barangay: input.barangay.trim(),
          lgu: input.lgu.trim(),
          areaId: input.areaId.trim(),
          activeBarangayId: null,
          officerRank: looksCaptain ? "captain" : "officer",
          officerTitle: looksCaptain ? "Punong Barangay" : null,
          ...idProofFields(input.idProof),
        };
        await setDoc(doc(getClientDb(), "users", cred.user.uid), {
          ...base,
          createdAtServer: serverTimestamp(),
        });

        const first = await isFirstActiveOfficerInBarangay(
          input.areaId,
          input.barangay,
        );
        const profileDoc: OfficerProfile = first
          ? {
              ...base,
              accountStatus: "active",
              activeBarangayId: input.areaId.trim(),
            }
          : base;
        if (first) {
          const { updateDoc } = await import("firebase/firestore");
          await updateDoc(doc(getClientDb(), "users", cred.user.uid), {
            accountStatus: "active",
            activeBarangayId: input.areaId.trim(),
            updatedAt: new Date().toISOString(),
            updatedAtServer: serverTimestamp(),
          });
          setPreferredAreaId(input.areaId.trim());
        }
        setProfile(profileDoc);
        const status: "pending" | "active" =
          profileDoc.accountStatus === "pending" ? "pending" : "active";
        return { accountStatus: status };
      } catch (err) {
        throw mapAuthError(err);
      }
    },
    [],
  );

  const registerCitizen = useCallback(
    async (input: {
      email: string;
      password: string;
      displayName: string;
      purok: string;
      phone: string;
      idProof: RegisterIdProof;
      areaId: string;
      barangay: string;
      lgu: string;
    }) => {
      if (!input.idProof.idVerified) {
        throw new Error("ID verification required before registration.");
      }
      if (!input.areaId.trim() || !input.barangay.trim()) {
        throw new Error("Choose your barangay / location to continue.");
      }
      try {
        const cred = await createUserWithEmailAndPassword(
          getClientAuth(),
          input.email,
          input.password,
        );
        await updateProfile(cred.user, {
          displayName: input.displayName,
          photoURL: input.idProof.photoURL ?? undefined,
        });

        const pending: CitizenProfile = {
          uid: cred.user.uid,
          email: input.email.trim().toLowerCase(),
          displayName: input.displayName,
          purok: input.purok,
          phone: input.phone,
          role: "citizen",
          createdAt: new Date().toISOString(),
          accountStatus: "pending",
          barangay: input.barangay.trim(),
          lgu: input.lgu.trim(),
          areaId: input.areaId.trim(),
          householdId: null,
          ...idProofFields(input.idProof),
        };
        await setDoc(doc(getClientDb(), "users", cred.user.uid), {
          ...pending,
          createdAtServer: serverTimestamp(),
        });

        // Match after auth so Firestore household reads are allowed.
        const match = await findMatchingHousehold({
          email: input.email,
          phone: input.phone,
          displayName: input.displayName,
          purok: input.purok,
          barangay: input.barangay,
        });
        const autoValidated = Boolean(match);
        let profileDoc = pending;
        if (match) {
          const { updateDoc } = await import("firebase/firestore");
          profileDoc = {
            ...pending,
            accountStatus: "active",
            householdId: match.id,
          };
          await updateDoc(doc(getClientDb(), "users", cred.user.uid), {
            accountStatus: "active",
            householdId: match.id,
            updatedAt: new Date().toISOString(),
            updatedAtServer: serverTimestamp(),
          });
          await linkCitizenToHousehold(match.id, cred.user.uid);
        }
        setProfile(profileDoc);
        return {
          autoValidated,
          householdId: match?.id ?? null,
        };
      } catch (err) {
        throw mapAuthError(err);
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    await signOut(getClientAuth());
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const auth = getClientAuth();
    const u = auth.currentUser;
    if (!u) {
      setProfile(null);
      return;
    }
    try {
      const snap = await getDoc(doc(getClientDb(), "users", u.uid));
      setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
    } catch {
      /* keep current */
    }
  }, []);

  const setActiveBarangay = useCallback(
    async (areaId: string, orgName?: string) => {
      const auth = getClientAuth();
      const u = auth.currentUser;
      if (!u) throw new Error("Not signed in");
      const payload: Record<string, unknown> = {
        activeBarangayId: areaId,
      };
      if (orgName?.trim()) payload.orgName = orgName.trim();
      await setDoc(doc(getClientDb(), "users", u.uid), payload, { merge: true });
      setProfile((prev) => {
        if (!prev || prev.role !== "officer") return prev;
        return {
          ...prev,
          activeBarangayId: areaId,
          ...(orgName?.trim() ? { orgName: orgName.trim() } : {}),
        };
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      login,
      register,
      registerCitizen,
      logout,
      refreshProfile,
      setActiveBarangay,
    }),
    [
      user,
      profile,
      loading,
      login,
      register,
      registerCitizen,
      logout,
      refreshProfile,
      setActiveBarangay,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
