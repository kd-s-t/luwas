"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { AuthCard } from "@/components/AuthCard";
import { AuthGate } from "@/components/AuthGate";
import {
  DEMO_CITIZENS,
  DEMO_ID_PROOF,
  findDemoCitizen,
  type DemoCitizen,
} from "@/lib/auth/demoAccount";
import { useAuth } from "@/lib/auth/AuthProvider";
import { requireLoginRole } from "@/lib/auth/requireLoginRole";
import { isSimulationOn } from "@/lib/config/simulation";
import { getClientAuth, getClientDb, useEmulators } from "@/lib/firebase/client";
import { syncCitizenPresenceFromDevice } from "@/lib/households/citizenPresence";

const FIRST = DEMO_CITIZENS[0]!;
const SIM = isSimulationOn();
/** Easy-login chips only on local emulators — hidden on prod. */
const SHOW_EASY_LOGINS = useEmulators;

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/my-reports";
  return raw;
}

function CitizenLoginForm() {
  const { login, registerCitizen, refreshProfile, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState<string>(
    SHOW_EASY_LOGINS ? FIRST.email : "",
  );
  const [password, setPassword] = useState<string>(
    SHOW_EASY_LOGINS ? FIRST.password : "",
  );
  const [selectedEmail, setSelectedEmail] = useState<string>(
    SHOW_EASY_LOGINS ? FIRST.email : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** Hackathon / demo: create missing citizen Auth+profile, then mark active. */
  async function ensureDemoCitizen(citizen: DemoCitizen) {
    try {
      await login(citizen.email, citizen.password);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      const missing =
        /user-not-found|invalid-credential|INVALID_LOGIN_CREDENTIALS/i.test(
          message,
        );
      if (!missing) throw err;
      try {
        await registerCitizen({
          email: citizen.email,
          password: citizen.password,
          displayName: citizen.displayName,
          purok: citizen.purok,
          phone: citizen.phone,
          areaId: "consolacion/nangka",
          barangay: "Nangka",
          lgu: "Consolacion",
          idProof: DEMO_ID_PROOF,
        });
      } catch (regErr) {
        const regMsg =
          regErr instanceof Error ? regErr.message : String(regErr);
        if (/email-already-in-use/i.test(regMsg)) {
          await login(citizen.email, citizen.password);
        } else {
          throw regErr;
        }
      }
    }

    const uid = getClientAuth().currentUser?.uid;
    if (!uid) return;
    try {
      await updateDoc(doc(getClientDb(), "users", uid), {
        role: "citizen",
        accountStatus: "active",
        barangay: "Nangka",
        lgu: "Consolacion",
        areaId: "consolacion/nangka",
        purok: citizen.purok,
        phone: citizen.phone,
        displayName: citizen.displayName,
        updatedAt: new Date().toISOString(),
        updatedAtServer: serverTimestamp(),
      });
      await refreshProfile();
    } catch {
      /* rules may block partial fields on older docs */
    }
  }

  function selectDemo(citizen: DemoCitizen) {
    setSelectedEmail(citizen.email);
    setEmail(citizen.email);
    setPassword(citizen.password);
    setError(null);
  }

  async function captureLocationAfterLogin(fallbackEmail: string) {
    const authUser = getClientAuth().currentUser;
    if (!authUser?.uid) return;
    await syncCitizenPresenceFromDevice({
      uid: authUser.uid,
      email: authUser.email ?? fallbackEmail,
      barangay: "Nangka",
    }).catch(() => {
      /* permission / offline — session sync may retry later */
    });
  }

  async function loginAs(citizen: DemoCitizen) {
    selectDemo(citizen);
    setSubmitting(true);
    try {
      await ensureDemoCitizen(citizen);
      await requireLoginRole("citizen", logout);
      await captureLocationAfterLogin(citizen.email);
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const trimmedEmail = email.trim();
    try {
      const demo = SIM ? findDemoCitizen(trimmedEmail, password) : undefined;
      if (demo) {
        await ensureDemoCitizen(demo);
      } else {
        await login(trimmedEmail, password);
      }
      await requireLoginRole("citizen", logout);
      await captureLocationAfterLogin(trimmedEmail);
      router.replace(nextPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(
        /user-not-found|invalid-credential/i.test(message)
          ? `${message} — open Register with ID to create this citizen.`
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGate mode="guest">
      <AuthCard
        title="Citizen login"
        subtitle="Report floods, slides, and other hazards from the field."
        footer={
          <>
            New citizen?{" "}
            <Link
              href="/register/citizen"
              className="text-[var(--accent)] hover:underline"
            >
              Register with ID
            </Link>
            {" · "}
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Change role
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {SHOW_EASY_LOGINS ? (
            <div className="space-y-2">
              <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Demo citizens · password demo1234
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_CITIZENS.map((c) => {
                  const selected = selectedEmail === c.email;
                  return (
                    <button
                      key={c.email}
                      type="button"
                      onClick={() => void loginAs(c)}
                      disabled={submitting}
                      className={`rounded-xl border px-2 py-1 font-mono text-[10px] tracking-wider uppercase transition disabled:opacity-60 ${
                        selected
                          ? "border-[var(--accent)] text-[var(--foreground)]"
                          : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {submitting && selected
                        ? "…"
                        : `${c.displayName.split(" ")[0]} · ${c.purok}`}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[var(--muted)]">
                Local emulators · accounts auto-create on first tap.
              </p>
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
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
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
              aria-invalid={!!error}
              aria-describedby={error ? "login-error" : undefined}
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
          </label>
          {error ? (
            <p
              id="login-error"
              className="text-sm text-[var(--danger)]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl w-full bg-[var(--accent)] px-4 py-2.5 font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-dim)] disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Open citizen reports"}
          </button>
        </form>
      </AuthCard>
    </AuthGate>
  );
}

export default function CitizenLoginPage() {
  return (
    <Suspense fallback={null}>
      <CitizenLoginForm />
    </Suspense>
  );
}
