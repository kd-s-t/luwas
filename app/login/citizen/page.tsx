"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { AuthGate } from "@/components/AuthGate";
import {
  DEMO_CITIZENS,
  DEMO_ID_PROOF,
  findDemoCitizen,
} from "@/lib/auth/demoAccount";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useEmulators } from "@/lib/firebase/client";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/citizen";
  return raw;
}

function CitizenLoginForm() {
  const { login, registerCitizen } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState(
    useEmulators ? DEMO_CITIZENS[0].email : "",
  );
  const [password, setPassword] = useState(
    useEmulators ? DEMO_CITIZENS[0].password : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function fillCitizen(index: number) {
    const c = DEMO_CITIZENS[index];
    if (!c) return;
    setEmail(c.email);
    setPassword(c.password);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const trimmedEmail = email.trim();
    try {
      try {
        await login(trimmedEmail, password);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        const missing =
          /user-not-found|invalid-credential|INVALID_LOGIN_CREDENTIALS/i.test(
            message,
          );
        const demo = findDemoCitizen(trimmedEmail, password);
        if (useEmulators && missing && demo) {
          try {
            await registerCitizen({
              email: demo.email,
              password: demo.password,
              displayName: demo.displayName,
              purok: demo.purok,
              phone: demo.phone,
              idProof: DEMO_ID_PROOF,
            });
          } catch (regErr) {
            const regMsg =
              regErr instanceof Error ? regErr.message : String(regErr);
            if (/email-already-in-use/i.test(regMsg)) {
              await login(trimmedEmail, password);
            } else {
              throw regErr;
            }
          }
        } else {
          throw err;
        }
      }
      router.replace(nextPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
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
            Officer?{" "}
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Command login
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {useEmulators ? (
            <div className="space-y-2">
              <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Demo citizens (password demo1234)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_CITIZENS.map((c, i) => (
                  <button
                    key={c.email}
                    type="button"
                    onClick={() => fillCitizen(i)}
                    className="border border-[var(--border)] px-2 py-1 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    {c.displayName.split(" ")[0]} · {c.purok}
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
