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
import { getClientAuth, getClientDb, useEmulators } from "@/lib/firebase/client";
import type { OfficerProfile } from "@/lib/auth/types";

function mapAuthError(err: unknown): Error {
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code: string }).code)
      : "";
  const message = err instanceof Error ? err.message : "Authentication failed";

  if (code === "auth/network-request-failed" || message.includes("network-request-failed")) {
    if (useEmulators) {
      return new Error(
        "Cannot reach Firebase Auth emulator (127.0.0.1:9099). Start it with: npm run emulators (requires Java 21+).",
      );
    }
    return new Error("Network error reaching Firebase Auth. Check your connection.");
  }

  return err instanceof Error ? err : new Error(message);
}

type AuthContextValue = {
  user: User | null;
  profile: OfficerProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    displayName: string;
    orgName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<OfficerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getClientAuth();
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const snap = await getDoc(doc(getClientDb(), "users", nextUser.uid));
        if (snap.exists()) {
          setProfile(snap.data() as OfficerProfile);
        } else {
          setProfile(null);
        }
      } catch {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
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
    }) => {
      try {
        const cred = await createUserWithEmailAndPassword(
          getClientAuth(),
          input.email,
          input.password,
        );
        await updateProfile(cred.user, { displayName: input.displayName });

        const profileDoc: OfficerProfile = {
          uid: cred.user.uid,
          email: input.email,
          displayName: input.displayName,
          orgName: input.orgName,
          role: "officer",
          createdAt: new Date().toISOString(),
        };

        await setDoc(doc(getClientDb(), "users", cred.user.uid), {
          ...profileDoc,
          createdAtServer: serverTimestamp(),
        });
        setProfile(profileDoc);
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

  const value = useMemo(
    () => ({ user, profile, loading, login, register, logout }),
    [user, profile, loading, login, register, logout],
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
