"use client";

import Link from "next/link";
import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { SupportBugForm } from "@/components/SupportBugForm";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function SupportPage() {
  const { user, loading } = useAuth();

  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="Help"
        title="Support"
        description="Report a website bug — broken pages, login issues, map glitches, or anything that blocks Luwas."
      />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-[var(--muted)]">
          Signed-in users only. For life-threatening emergencies, call local
          responders (PNP / BFP / barangay) — do not wait on this form.
        </p>
        {loading ? (
          <p className="font-mono text-sm tracking-wider text-[var(--muted)] uppercase">
            Checking sign-in…
          </p>
        ) : user ? (
          <SupportBugForm />
        ) : (
          <div className="border border-[var(--border)] bg-[var(--surface)] px-4 py-5 text-sm text-[var(--muted)]">
            <p className="text-[var(--foreground)]">
              Sign in to send a bug report.
            </p>
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              <Link
                href="/login/citizen"
                className="text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Citizen login
              </Link>
              <Link
                href="/login"
                className="text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Officer login
              </Link>
            </p>
          </div>
        )}
      </main>
    </PublicShell>
  );
}
