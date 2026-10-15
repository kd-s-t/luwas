"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { AuthGate } from "@/components/AuthGate";
import {
  DEMO_ID_PROOF,
  DEMO_OFFICERS,
  findDemoOfficer,
  type DemoOfficer,
} from "@/lib/auth/demoOfficers";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isSimulationOn } from "@/lib/config/simulation";
import { useEmulators } from "@/lib/firebase/client";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import type { UserProfile } from "@/lib/auth/types";

const CAPTAIN = DEMO_OFFICERS.find((o) => o.id === "captain") ?? DEMO_OFFICERS[0]!;
const SIM = isSimulationOn();

export default function LoginPage() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState<string>(SIM ? CAPTAIN.email : "");
  const [password, setPassword] = useState<string>(SIM ? CAPTAIN.password : "");
  const [selectedDemoId, setSelectedDemoId] = useState<string>(
    SIM ? CAPTAIN.id : "",
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
      if (!missing) throw err;
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
            accountStatus: "active",
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
    setSelectedDemoId(officer.id);
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
      router.replace("/admin/overview");
      return;
    }
    const snap = await getDoc(doc(getClientDb(), "users", uid));
    const profile = snap.exists() ? (snap.data() as UserProfile) : null;
    router.replace(profile?.role === "citizen" ? "/my-reports" : "/admin/overview");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const trimmedEmail = email.trim();
    try {
      const demo = SIM ? findDemoOfficer(trimmedEmail, password) : undefined;
      if (demo) {
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
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Change role
            </Link>
            {" · "}
            No officer account?{" "}
            <Link href="/register" className="text-[var(--accent)] hover:underline">
              Register
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-5">
          {SIM ? (
            <div className="space-y-2">
              <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Demo roles · password demo1234
              </p>
              <ul className="divide-y divide-[var(--border)] border border-[var(--border)]">
                {DEMO_OFFICERS.map((o) => {
                  const selected = selectedDemoId === o.id;
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        onClick={() => void loginAs(o)}
                        disabled={submitting}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition disabled:opacity-60 ${
                          selected
                            ? "bg-[var(--accent)]/5"
                            : "hover:bg-[var(--surface-raised)]"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-[var(--foreground)]">
                            {o.label}
                            {o.id === "captain" ? (
                              <span className="font-normal text-[var(--muted)]">
                                {" "}
                                · recommended
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--muted)]">
                            {o.displayName}
                          </span>
                        </span>
                        <span
                          className={`shrink-0 font-mono text-[10px] tracking-wider uppercase ${
                            selected
                              ? "text-[var(--accent)]"
                              : "text-[var(--muted)]"
                          }`}
                        >
                          {submitting && selected ? "…" : "Enter"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-[var(--muted)]">
                {useEmulators
                  ? "Local emulators · accounts auto-create on first Enter."
                  : "Prod demo · tap Captain to open command as Punong Barangay."}
              </p>
            </div>
          ) : null}

          {SIM ? (
            <div className="relative">
              <div
                className="absolute inset-x-0 top-1/2 border-t border-[var(--border)]"
                aria-hidden
              />
              <p className="relative mx-auto w-fit bg-[var(--surface)] px-2 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Or email
              </p>
            </div>
          ) : null}

          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1.5 block text-[var(--muted)]">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSelectedDemoId("");
                }}
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
          </div>
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
