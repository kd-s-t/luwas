"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { AuthGate } from "@/components/AuthGate";
import { DEMO_OFFICER } from "@/lib/auth/demoAccount";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useEmulators } from "@/lib/firebase/client";

export default function RegisterPage() {
  const { register, login } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(
    useEmulators ? DEMO_OFFICER.displayName : "",
  );
  const [orgName, setOrgName] = useState(
    useEmulators ? DEMO_OFFICER.orgName : "",
  );
  const [email, setEmail] = useState(
    useEmulators ? DEMO_OFFICER.email : "",
  );
  const [password, setPassword] = useState(
    useEmulators ? DEMO_OFFICER.password : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function fillDemo() {
    setDisplayName(DEMO_OFFICER.displayName);
    setOrgName(DEMO_OFFICER.orgName);
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
        await register({
          email: trimmedEmail,
          password,
          displayName: displayName.trim(),
          orgName: orgName.trim(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        // Account already exists — sign in with the same credentials
        if (/email-already-in-use/i.test(message)) {
          await login(trimmedEmail, password);
        } else {
          throw err;
        }
      }
      router.replace("/command");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(
        /email-already-in-use/i.test(message)
          ? "That email is already registered. Use Login with the same password."
          : message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGate mode="guest">
      <AuthCard
        title="Register officer"
        subtitle="Create a Capitan / DRRM officer account for your barangay or LGU."
        footer={
          <>
            Already registered?{" "}
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Login
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
              Fill demo account
            </button>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Full name</span>
            <input
              type="text"
              required
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">
              Barangay / LGU / org
            </span>
            <input
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Brgy. Nangka MDRRMO"
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/50"
            />
          </label>
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
            <span className="mb-1.5 block text-[var(--muted)]">
              Password (min 6)
            </span>
            <input
              type="password"
              required
              autoComplete="new-password"
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
            {submitting ? "Creating account…" : "Create officer account"}
          </button>
        </form>
      </AuthCard>
    </AuthGate>
  );
}
