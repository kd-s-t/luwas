"use client";

import { useEffect, useState } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { ACCEPTED_ID_TYPES } from "@/lib/auth/idTypes";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen, isOfficer } from "@/lib/auth/types";
import { getClientStorage } from "@/lib/firebase/client";

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

function useIdentitySrc(
  url: string | null | undefined,
  path: string | null | undefined,
): { src: string | null; loading: boolean; missing: boolean } {
  const [src, setSrc] = useState<string | null>(url?.trim() || null);
  const [loading, setLoading] = useState(!url?.trim() && Boolean(path?.trim()));
  const [missing, setMissing] = useState(!url?.trim() && !path?.trim());

  useEffect(() => {
    const direct = url?.trim() || "";
    const storagePath = path?.trim() || "";
    if (direct) {
      setSrc(direct);
      setLoading(false);
      setMissing(false);
      return;
    }
    if (!storagePath) {
      setSrc(null);
      setLoading(false);
      setMissing(true);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setMissing(false);
    void getDownloadURL(ref(getClientStorage(), storagePath))
      .then((next) => {
        if (cancelled) return;
        setSrc(next);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSrc(null);
        setLoading(false);
        setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url, path]);

  return { src, loading, missing };
}

function IdPhoto({
  label,
  url,
  path,
}: {
  label: string;
  url?: string | null;
  path?: string | null;
}) {
  const { src, loading, missing } = useIdentitySrc(url, path);

  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
        {label}
      </p>
      {loading ? (
        <p className="font-mono text-xs text-[var(--muted)]">Loading…</p>
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element -- Storage download URLs
        <img
          src={src}
          alt={label}
          className="max-h-64 w-full border border-[var(--border)] bg-[var(--surface-panel)] object-contain"
        />
      ) : missing ? (
        <p className="text-sm text-[var(--muted)]">No photo on file.</p>
      ) : null}
    </div>
  );
}

function ProfileBody() {
  const { profile, user } = useAuth();

  const name = profile?.displayName ?? user?.email ?? "Account";
  const roleLabel = isOfficer(profile)
    ? "Officer"
    : isCitizen(profile)
      ? "Citizen"
      : "Signed in";

  return (
    <>
      {!isOfficer(profile) ? (
        <PublicPageHeader
          eyebrow="Account"
          title="Profile"
          description={`${name} · ${roleLabel}`}
        />
      ) : null}
      <main
        className={
          isOfficer(profile)
            ? "mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-6"
            : "mx-auto max-w-3xl px-4 py-8 sm:px-6"
        }
      >
        {isOfficer(profile) ? (
          <div className="mb-5">
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Account
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
              Profile
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {name} · {roleLabel}
            </p>
          </div>
        ) : null}
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
              <Row label="ID type" value={idTypeLabel(profile.idType)} />
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

            <div className="space-y-5 border-t border-[var(--border)] px-4 py-5">
              <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
                Uploaded ID
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                <IdPhoto
                  label="Government ID"
                  url={profile.idDocumentUrl}
                  path={profile.idDocumentPath}
                />
                <IdPhoto
                  label="Selfie"
                  url={profile.faceDocumentUrl ?? profile.photoURL}
                  path={profile.faceDocumentPath}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="font-mono text-sm tracking-wider text-[var(--muted)] uppercase">
            Loading profile…
          </p>
        )}
      </main>
    </>
  );
}

export default function ProfilePage() {
  const { profile } = useAuth();

  return (
    <AuthGate mode="protected">
      {isOfficer(profile) ? (
        <CommandShell>
          <ProfileBody />
        </CommandShell>
      ) : (
        <PublicShell>
          <ProfileBody />
        </PublicShell>
      )}
    </AuthGate>
  );
}
