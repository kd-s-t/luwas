"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { AuthCard } from "@/components/AuthCard";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";

const DEFAULT_EMAIL = "developer@luwas.demo";
const DEFAULT_PASSWORD = "demo1234";
const DISPLAY_NAME = "LUWAS Developer";

export default function DeveloperLoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function ensureDeveloperProfile(uid: string, mail: string) {
    const ref = doc(getClientDb(), "users", uid);
    const snap = await getDoc(ref);
    const now = new Date().toISOString();
    if (snap.exists()) {
      const role = (snap.data() as { role?: string }).role;
      if (role === "developer") return;
      throw new Error("This account is not a developer.");
    }
    await setDoc(ref, {
      uid,
      email: mail,
      displayName: DISPLAY_NAME,
      role: "developer",
      accountStatus: "active",
      orgName: "LUWAS Developers",
      idVerified: true,
      createdAt: now,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    });
  }

  async function ensureDeveloperAuth(mail: string, pass: string) {
    try {
      await login(mail, pass);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const missing =
        /user-not-found|invalid-credential|INVALID_LOGIN_CREDENTIALS/i.test(
          message,
        );
      if (!missing) throw err;
      try {
        const cred = await createUserWithEmailAndPassword(
          getClientAuth(),
          mail,
          pass,
        );
        await updateProfile(cred.user, { displayName: DISPLAY_NAME });
      } catch (createErr) {
        const createMsg =
          createErr instanceof Error ? createErr.message : String(createErr);
        if (/email-already-in-use/i.test(createMsg)) {
          await login(mail, pass);
        } else {
          throw createErr;
        }
      }
    }
    const uid = getClientAuth().currentUser?.uid;
    if (!uid) throw new Error("Sign-in failed.");
    await ensureDeveloperProfile(uid, mail);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const mail = email.trim().toLowerCase();
      await ensureDeveloperAuth(mail, password);
      const uid = getClientAuth().currentUser?.uid;
      if (!uid) throw new Error("Sign-in failed.");
      const snap = await getDoc(doc(getClientDb(), "users", uid));
      const data = snap.data() as { role?: string } | undefined;
      if (!snap.exists() || data?.role !== "developer") {
        setError("This account is not a developer.");
        setSubmitting(false);
        return;
      }
      router.replace("/dev");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setSubmitting(false);
    }
  }

  return (
    <AuthGate mode="guest">
      <AuthCard
        title="Developer login"
        subtitle="Ops console · all users · operational barangays · onboard."
        footer={
          <>
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Other logins
            </Link>
            <span className="mt-2 block text-[11px] text-[var(--muted)]">
              Demo · {DEFAULT_EMAIL} / {DEFAULT_PASSWORD} · auto-creates on
              first sign-in
            </span>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">
              Email
            </span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">
              Password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              required
            />
          </label>
          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </AuthCard>
    </AuthGate>
  );
}
