"use client";

import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { HouseholdsPanel } from "@/components/HouseholdsPanel";
import { SituationMap } from "@/components/SituationMap";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useEmulators } from "@/lib/firebase/client";

export default function CommandPage() {
  const { profile, user, logout } = useAuth();

  return (
    <AuthGate mode="protected">
      <div className="min-h-screen">
        <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-raised)]/90 px-4 py-3 backdrop-blur sm:px-6">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Live · Local{useEmulators ? " · Emulators" : ""}
            </p>
            <Link
              href="/"
              className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide sm:text-3xl"
            >
              Luwas
            </Link>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div className="hidden sm:block">
              <p className="text-sm font-medium">
                {profile?.displayName ?? user?.email}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {profile?.orgName ?? "Officer"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          {user ? (
            <>
              <SituationMap officerUid={user.uid} />
              <HouseholdsPanel
                officerUid={user.uid}
                orgName={profile?.orgName ?? ""}
              />
            </>
          ) : null}
        </main>
      </div>
    </AuthGate>
  );
}
