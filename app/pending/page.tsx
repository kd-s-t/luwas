"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { AuthPageSkeleton } from "@/components/AuthPageSkeleton";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isAccountActive,
  isAccountFired,
  isAccountPending,
  isCitizen,
  isDeveloper,
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
      router.replace(
        isCitizen(profile)
          ? "/my-reports"
          : isDeveloper(profile)
            ? "/dev"
            : "/admin/overview",
      );
    }
  }, [loading, user, profile, router]);

  if (loading || !user) {
    return <AuthPageSkeleton />;
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
          : "Gemini could not auto-approve (ID issue or no homeowner match). An officer will call you, then confirm."
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
        {isCitizen(profile) && profile.phone ? (
          <p>Phone on file · {profile.phone}</p>
        ) : null}
        {profile?.barangay ? (
          <p className="font-mono text-[10px] tracking-wider uppercase text-[var(--accent)]">
            Location · Brgy. {profile.barangay}
            {profile.lgu ? `, ${profile.lgu}` : ""}
          </p>
        ) : null}
        {profile?.idReason ? (
          <p className="text-xs">Gemini · {profile.idReason}</p>
        ) : null}
        <p>
          You will get an email when confirmed or rejected. After confirm, sign
          in again to open{" "}
          {isCitizen(profile) ? "citizen reports" : "command center"}.
        </p>
      </div>
    </AuthCard>
  );
}
