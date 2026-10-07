"use client";

import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { CitizenReportForm } from "@/components/CitizenReportForm";
import { CitizenReportsList } from "@/components/CitizenReportsList";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen, isOfficer } from "@/lib/auth/types";

export default function CitizenPage() {
  const { profile, user, logout } = useAuth();

  const subtitle = isCitizen(profile)
    ? profile.purok
    : isOfficer(profile)
      ? `${profile.orgName} · Officer`
      : "Field reports";

  return (
    <AuthGate mode="protected">
      <div className="min-h-screen">
        <FadeIn y={8}>
          <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-raised)]/90 px-4 py-3 backdrop-blur sm:px-6">
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
                My posts · Field reports
              </p>
              <Link
                href="/"
                className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide"
              >
                Luwas
              </Link>
            </div>
            <div className="flex items-center gap-3 text-right">
              <div className="hidden sm:block">
                <p className="text-sm font-medium">
                  {profile?.displayName ?? user?.email}
                </p>
                <p className="text-xs text-[var(--muted)]">{subtitle}</p>
              </div>
              {isOfficer(profile) ? (
                <Link
                  href="/command"
                  className="border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                >
                  Command
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => logout()}
                className="border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
              >
                Logout
              </button>
            </div>
          </header>
        </FadeIn>

        <main className="mx-auto grid max-w-5xl gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:grid-cols-2">
          {profile ? (
            <>
              <FadeIn delay={0.06} y={14}>
                <CitizenReportForm author={profile} />
              </FadeIn>
              <FadeIn delay={0.12} y={14}>
                <CitizenReportsList citizenUid={profile.uid} />
              </FadeIn>
            </>
          ) : null}
        </main>
      </div>
    </AuthGate>
  );
}
