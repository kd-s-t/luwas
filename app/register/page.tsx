"use client";

import Link from "next/link";
import { AuthCard } from "@/components/AuthCard";
import { AuthGate } from "@/components/AuthGate";

export default function RegisterChooserPage() {
  return (
    <AuthGate mode="guest">
      <AuthCard
        title="Create a LUWAS account"
        subtitle="Choose how you’ll use LUWAS."
        footer={
          <>
            Already registered?{" "}
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Officer login
            </Link>
            {" · "}
            <Link
              href="/login/citizen"
              className="text-[var(--accent)] hover:underline"
            >
              Citizen login
            </Link>
          </>
        }
      >
        <div className="grid gap-3">
          <Link
            href="/register/citizen"
            className="group border border-[var(--border)] px-4 py-4 transition hover:border-[var(--accent)] hover:bg-[var(--surface-panel)]/50"
          >
            <p className="font-medium text-[var(--foreground)] group-hover:text-[var(--accent)]">
              Citizen
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Report hazards, track your posts, and get barangay alerts.
            </p>
          </Link>
          <Link
            href="/register/officer"
            className="group border border-[var(--border)] px-4 py-4 transition hover:border-[var(--accent)] hover:bg-[var(--surface-panel)]/50"
          >
            <p className="font-medium text-[var(--foreground)] group-hover:text-[var(--accent)]">
              Officer
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Command center, field reports queue, households, and onboarding.
            </p>
          </Link>
        </div>
      </AuthCard>
    </AuthGate>
  );
}
