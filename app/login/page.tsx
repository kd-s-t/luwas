"use client";

import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { AuthGate } from "@/components/AuthGate";

export default function LoginChoosePage() {
  return (
    <AuthGate mode="guest">
      <AuthCard
        title="Login"
        subtitle="Choose how you use LUWAS."
        footer={
          <>
            New here?{" "}
            <Link
              href="/register"
              className="text-[var(--accent)] hover:underline"
            >
              Register
            </Link>
          </>
        }
      >
        <div className="space-y-3">
          <Link
            href="/login/officer"
            className="block border border-[var(--border)] px-4 py-4 transition hover:border-[var(--accent)] hover:bg-[var(--surface-raised)]"
          >
            <span className="block text-base font-semibold text-[var(--foreground)]">
              Officer
            </span>
            <span className="mt-1 block text-sm text-[var(--muted)]">
              Captain, MDRRMO, or LGU: command center
            </span>
          </Link>
          <Link
            href="/login/citizen"
            className="block border border-[var(--border)] px-4 py-4 transition hover:border-[var(--accent)] hover:bg-[var(--surface-raised)]"
          >
            <span className="block text-base font-semibold text-[var(--foreground)]">
              Citizen
            </span>
            <span className="mt-1 block text-sm text-[var(--muted)]">
              Report hazards and track your submissions
            </span>
          </Link>
          <Link
            href="/login/developer"
            className="block border border-[var(--border)] px-4 py-4 transition hover:border-[var(--accent)] hover:bg-[var(--surface-raised)]"
          >
            <span className="block text-base font-semibold text-[var(--foreground)]">
              Developer
            </span>
            <span className="mt-1 block text-sm text-[var(--muted)]">
              Ken, Don, Jean, Pat · About us team console
            </span>
          </Link>
        </div>
      </AuthCard>
    </AuthGate>
  );
}
