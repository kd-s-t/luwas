"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { AuthGate } from "@/components/AuthGate";
import { DEMO_OFFICER } from "@/lib/auth/demoAccount";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useEmulators } from "@/lib/firebase/client";

function isDemoCredentials(email: string, password: string) {
  return (
    email.trim().toLowerCase() === DEMO_OFFICER.email &&
    password === DEMO_OFFICER.password
  );
}

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

  function fillDemo() {
    setEmail(DEMO_OFFICER.email);
    setPassword(DEMO_OFFICER.password);
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
        // Local emulator: create the prefilled demo officer on first login
        if (useEmulators && missing && isDemoCredentials(trimmedEmail, password)) {
          try {
            await register({
              email: DEMO_OFFICER.email,
              password: DEMO_OFFICER.password,
              displayName: DEMO_OFFICER.displayName,
              orgName: DEMO_OFFICER.orgName,
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
      router.replace("/command");
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
        subtitle="Sign in to Luwas."
        footer={
          <>
            No account?{" "}
            <Link href="/register" className="text-[var(--accent)] hover:underline">
              Register
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {useEmulators ? (
            <button
              type="button"
              onClick={fillDemo}
              className="w-full border border-[var(--border)] px-3 py-2 font-mono text-xs tracking-wider text-[var(--muted)] uppercase transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            >
              Use demo account
            </button>
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
