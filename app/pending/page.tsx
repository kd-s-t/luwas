"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isAccountActive,
  isAccountFired,
  isAccountPending,
  isCitizen,
  isOfficer,
} from "@/lib/auth/types";

export default function PendingValidationPage() {
  const { user, profile, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (isAccountActive(profile)) {
      router.replace(isCitizen(profile) ? "/my-reports" : "/command");
    }
  }, [loading, user, profile, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[var(--muted)]">
        <p className="font-mono text-sm tracking-widest uppercase">
          Establishing link…
        </p>
      </div>
    );
  }

  if (profile && isAccountFired(profile)) {
    const fired = profile;
    return (
      <AuthCard
        title="Removed from staff"
        subtitle="The barangay captain ended your officer access. Your record is kept for history."
        footer={
          <button
            type="button"
            onClick={() => void logout().then(() => router.replace("/login"))}
            className="text-[var(--accent)] hover:underline"
          >
            Sign out
          </button>
        }
      >
        <div className="space-y-2 text-sm text-[var(--muted)]">
          <p>
            {fired.displayName} · {fired.email}
          </p>
          {isOfficer(fired) && fired.firedReason ? (
            <p>Reason · {fired.firedReason}</p>
          ) : null}
        </div>
      </AuthCard>
    );
  }

  if (!isAccountPending(profile) && profile?.accountStatus === "rejected") {
    return (
      <AuthCard
        title="Account not approved"
        subtitle="An officer rejected this registration. Contact your barangay MDRRMO."
        footer={
          <button
            type="button"
            onClick={() => void logout().then(() => router.replace("/login"))}
            className="text-[var(--accent)] hover:underline"
          >
            Sign out
          </button>
        }
      >
        <p className="text-sm text-[var(--muted)]">
          {profile.displayName} · {profile.email}
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Waiting for validation"
      subtitle={
        isOfficer(profile)
          ? "Another active officer in your barangay must approve your account."
          : "A barangay officer will verify your registration. Matching house-owner records validate automatically."
      }
      footer={
        <>
          <button
            type="button"
            onClick={() => void logout().then(() => router.replace("/login"))}
            className="text-[var(--accent)] hover:underline"
          >
            Sign out
          </button>
          {" · "}
          <Link href="/" className="text-[var(--accent)] hover:underline">
            Home
          </Link>
        </>
      }
    >
      <div className="space-y-2 text-sm text-[var(--muted)]">
        <p>
          <span className="text-[var(--foreground)]">{profile?.displayName}</span>
          {" · "}
          {profile?.email}
        </p>
        {profile?.barangay ? (
          <p className="font-mono text-[10px] tracking-wider uppercase text-[var(--accent)]">
            Location · Brgy. {profile.barangay}
            {profile.lgu ? `, ${profile.lgu}` : ""}
          </p>
        ) : null}
        <p>
          You can close this tab — once approved, sign in again to open{" "}
          {isCitizen(profile) ? "citizen reports" : "command center"}.
        </p>
      </div>
    </AuthCard>
  );
}
