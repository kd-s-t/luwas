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
import { requireLoginRole } from "@/lib/auth/requireLoginRole";
import { useEmulators } from "@/lib/firebase/client";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";

const CAPTAIN =
  DEMO_OFFICERS.find((o) => o.id === "captain") ?? DEMO_OFFICERS[0]!;
/** Easy-login roster only on local emulators — hidden on prod. */
const SHOW_EASY_LOGINS = useEmulators;

export default function LoginPage() {
  const { login, register, logout } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState<string>(
    SHOW_EASY_LOGINS ? CAPTAIN.email : "",
  );
  const [password, setPassword] = useState<string>(
    SHOW_EASY_LOGINS ? CAPTAIN.password : "",
  );
  const [selectedDemoId, setSelectedDemoId] = useState<string>(
    SHOW_EASY_LOGINS ? CAPTAIN.id : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function ensureBootstrapOfficer(officer: DemoOfficer) {
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
          areaId: officer.areaId,
          barangay: officer.barangay,
          lgu: officer.lgu,
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
    const uid = getClientAuth().currentUser?.uid;
    if (uid) {
      try {
        await updateDoc(doc(getClientDb(), "users", uid), {
          ...(officer.officerRank === "captain"
            ? {
                officerRank: "captain",
                officerTitle: officer.staffTitle,
              }
            : {
                officerTitle: officer.staffTitle,
              }),
          barangay: officer.barangay,
          lgu: officer.lgu,
          areaId: officer.areaId,
          activeBarangayId: officer.areaId,
          orgName: officer.orgName,
          accountStatus: "active",
          updatedAt: new Date().toISOString(),
          updatedAtServer: serverTimestamp(),
        });
      } catch {
        /* rules may block partial fields on older docs */
      }
    }

    // Apas: ensure area is onboarded + starter roster in prod Auth/Firestore.
    if (officer.areaId === "cebu-city/apas" && uid) {
      try {
        const { listMapAreaOptions, resolveKnownMapArea } = await import(
          "@/lib/geo/mapAreas"
        );
        const {
          emptyChecklist,
          setPreferredAreaId,
        } = await import("@/lib/onboarding/types");
        const { getOnboardedBarangay, saveOnboardedBarangay } = await import(
          "@/lib/onboarding/storage"
        );
        const { ensureApasOpsSeed } = await import("@/lib/onboarding/apasSeed");
        if (!getOnboardedBarangay(officer.areaId)) {
          const opt = listMapAreaOptions().find((o) => o.id === officer.areaId);
          if (opt) {
            const area = resolveKnownMapArea(opt);
            const now = new Date().toISOString();
            await saveOnboardedBarangay({
              id: area.id,
              barangay: area.barangay,
              lgu: area.lgu,
              name: area.name,
              orgName: officer.orgName,
              hallAddress: `Brgy. ${area.barangay} Hall, ${area.lgu}`,
              hotline: "",
              email: officer.email,
              center: { ...area.center },
              zoom: area.zoom,
              checklist: emptyChecklist(),
              activatedAt: now,
              updatedAt: now,
              activatedBy: uid,
            });
          }
        }
        setPreferredAreaId(officer.areaId);
        await ensureApasOpsSeed(uid);
      } catch (seedErr) {
        console.warn("[login] Apas onboard/seed failed", seedErr);
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
      await ensureBootstrapOfficer(officer);
      await requireLoginRole("officer", logout);
      router.replace("/admin/overview");
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
      const bootstrap = findDemoOfficer(trimmedEmail, password);
      if (bootstrap) {
        await ensureBootstrapOfficer(bootstrap);
      } else {
        await login(trimmedEmail, password);
      }
      await requireLoginRole("officer", logout);
      router.replace("/admin/overview");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(
        /user-not-found|invalid-credential/i.test(message)
          ? `${message}. Open Register to create this officer.`
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
        subtitle="Nangka, Apas, MDRRMO, or LGU: sign in to UGNAI command."
        footer={
          <>
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Change role
            </Link>
            {" · "}
            <Link
              href="/login/developer"
              className="text-[var(--accent)] hover:underline"
            >
              Developer login
            </Link>
            {" · "}
            No officer account?{" "}
            <Link
              href="/register"
              className="text-[var(--accent)] hover:underline"
            >
              Register
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-5">
          {SHOW_EASY_LOGINS ? (
            <>
              <div className="space-y-2">
                <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                  Officer roles · password demo1234
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
                                  · Nangka
                                </span>
                              ) : null}
                              {o.id === "apas-captain" ? (
                                <span className="font-normal text-[var(--muted)]">
                                  {" "}
                                  · Cebu City
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
                  Local emulators · accounts auto-create on first Enter.
                </p>
              </div>

              <div className="relative">
                <div
                  className="absolute inset-x-0 top-1/2 border-t border-[var(--border)]"
                  aria-hidden
                />
                <p className="relative mx-auto w-fit bg-[var(--surface)] px-2 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                  Or email
                </p>
              </div>
            </>
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
          </div>
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
            {submitting ? "Signing in…" : "Enter command center"}
          </button>
        </form>
      </AuthCard>
    </AuthGate>
  );
}
