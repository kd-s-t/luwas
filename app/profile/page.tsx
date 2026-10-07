"use client";

import { AuthGate } from "@/components/AuthGate";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { ACCEPTED_ID_TYPES } from "@/lib/auth/idTypes";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen, isOfficer } from "@/lib/auth/types";

function idTypeLabel(id: string | null | undefined): string {
  if (!id) return "—";
  return ACCEPTED_ID_TYPES.find((t) => t.id === id)?.label ?? id;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-[var(--border)] px-4 py-3 sm:grid-cols-[10rem_1fr] sm:items-baseline">
      <dt className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
        {label}
      </dt>
      <dd className="text-sm text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const { profile, user } = useAuth();

  const name = profile?.displayName ?? user?.email ?? "Account";
  const roleLabel = isOfficer(profile)
    ? "Officer"
    : isCitizen(profile)
      ? "Citizen"
      : "Signed in";

  return (
    <AuthGate mode="protected">
      <PublicShell>
        <PublicPageHeader
          eyebrow="Account"
          title="Profile"
          description={`${name} · ${roleLabel}`}
        />
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          {profile ? (
            <div className="border border-[var(--border)] bg-[var(--surface)]">
              <div className="flex items-center gap-4 border-b border-[var(--border)] px-4 py-5">
                <ProfileAvatar
                  name={profile.displayName}
                  photoURL={profile.photoURL}
                  size="lg"
                  className="!size-16 !text-base"
                />
                <div className="min-w-0">
                  <p className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
                    {profile.displayName}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                    {roleLabel}
                    {profile.idVerified ? " · ID verified" : ""}
                  </p>
                </div>
              </div>

              <dl>
                <Row label="Email" value={profile.email} />
                <Row label="Role" value={roleLabel} />
                {isCitizen(profile) ? (
                  <>
                    <Row label="Purok" value={profile.purok} />
                    <Row label="Phone" value={profile.phone || "—"} />
                  </>
                ) : null}
                {isOfficer(profile) ? (
                  <Row label="Organization" value={profile.orgName} />
                ) : null}
                <Row
                  label="ID type"
                  value={idTypeLabel(profile.idType)}
                />
                <Row
                  label="ID status"
                  value={
                    profile.idVerified
                      ? `Verified${
                          profile.idConfidence != null
                            ? ` · ${Math.round(profile.idConfidence * 100)}%`
                            : ""
                        }`
                      : "Not verified"
                  }
                />
                <Row
                  label="Member since"
                  value={
                    profile.createdAt
                      ? new Date(profile.createdAt).toLocaleString()
                      : "—"
                  }
                />
              </dl>
            </div>
          ) : (
            <p className="font-mono text-sm tracking-wider text-[var(--muted)] uppercase">
              Loading profile…
            </p>
          )}
        </main>
      </PublicShell>
    </AuthGate>
  );
}
