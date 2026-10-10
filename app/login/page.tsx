"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { AuthGate } from "@/components/AuthGate";
import { DEMO_OFFICER } from "@/lib/auth/demoAccount";
import {
  DEMO_ID_PROOF,
  DEMO_OFFICERS,
  findDemoOfficer,
  type DemoOfficer,
} from "@/lib/auth/demoOfficers";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useEmulators } from "@/lib/firebase/client";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import type { UserProfile } from "@/lib/auth/types";

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(
    useEmulators ? DEMO_OFFICER.email : "",
  );
  const [password, setPassword] = useState(
    useEmulators ? DEMO_OFFICER.password : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function ensureDemoOfficer(officer: DemoOfficer) {
    try {
      await login(officer.email, officer.password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const missing =
        /user-not-found|invalid-credential|INVALID_LOGIN_CREDENTIALS/i.test(
          message,
        );
      if (!useEmulators || !missing) throw err;
      try {
        await register({
          email: officer.email,
          password: officer.password,
          displayName: officer.displayName,
          orgName: officer.orgName,
          areaId: "consolacion/nangka",
          barangay: "Nangka",
          lgu: "Consolacion",
          idProof: DEMO_ID_PROOF,
        });
      } catch (regErr) {
        const regMsg =
          regErr instanceof Error ? regErr.message : String(regErr);
        if (/email-already-in-use/i.test(regMsg)) {
          await login(officer.email, officer.password);
        } else {
          throw regErr;
        }
      }
    }
    // Stamp captain rank on demo Punong so hire/fire rules work.
    if (officer.id === "captain") {
      const uid = getClientAuth().currentUser?.uid;
      if (uid) {
        try {
          await updateDoc(doc(getClientDb(), "users", uid), {
            officerRank: "captain",
            officerTitle: "Punong Barangay",
            barangay: "Nangka",
            lgu: "Consolacion",
            areaId: "consolacion/nangka",
            updatedAt: new Date().toISOString(),
            updatedAtServer: serverTimestamp(),
          });
        } catch {
          /* rules may block partial fields on older docs — org/email still match */
        }
      }
    }
  }

  async function loginAs(officer: DemoOfficer) {
    setEmail(officer.email);
    setPassword(officer.password);
    setError(null);
    setSubmitting(true);
    try {
      await ensureDemoOfficer(officer);
      await redirectForCurrentUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function redirectForCurrentUser() {
    const uid = getClientAuth().currentUser?.uid;
    if (!uid) {
      router.replace("/command");
      return;
    }
    const snap = await getDoc(doc(getClientDb(), "users", uid));
    const profile = snap.exists() ? (snap.data() as UserProfile) : null;
    router.replace(profile?.role === "citizen" ? "/citizen" : "/command");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const trimmedEmail = email.trim();
    try {
      const demo = findDemoOfficer(trimmedEmail, password);
      if (useEmulators && demo) {
        await ensureDemoOfficer(demo);
      } else {
        await login(trimmedEmail, password);
      }
      await redirectForCurrentUser();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(
        /user-not-found|invalid-credential/i.test(message)
          ? `${message} — open Register to create this officer.`
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGate mode="guest">
      <AuthCard
        title="Officer login"
        subtitle="Captain, MDRRMO, or LGU — sign in to LUWAS command."
        footer={
          <>
            Citizen reporter?{" "}
            <Link
              href="/login/citizen"
              className="text-[var(--accent)] hover:underline"
            >
              Citizen login
            </Link>
            {" · "}
            No officer account?{" "}
            <Link href="/register" className="text-[var(--accent)] hover:underline">
              Register
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {useEmulators ? (
            <div className="space-y-2">
              <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Demo roles
              </p>
              <div className="grid gap-2">
                {DEMO_OFFICERS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => void loginAs(o)}
                    disabled={submitting}
                    className="w-full border border-[var(--border)] px-3 py-2 text-left transition hover:border-[var(--accent)] disabled:opacity-60"
                  >
                    <span className="block text-sm font-medium text-[var(--foreground)]">
                      {o.label}
                    </span>
                    <span className="block font-mono text-[10px] text-[var(--muted)]">
                      {o.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
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
            className="w-full bg-[var(--accent)] px-4 py-2.5 font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-dim)] disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Enter command center"}
          </button>
        </form>
      </AuthCard>
    </AuthGate>
  );
}
