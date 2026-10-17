"use client";

import { useEffect, useState, type FormEvent } from "react";
import { updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isDeveloper } from "@/lib/auth/types";
import { getClientDb } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";

export function DeveloperProfilePanel() {
  const { profile, user, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDeveloper(profile)) return;
    setDisplayName(profile.displayName || "");
    setOrgName(profile.orgName || "");
    setPhotoURL(profile.photoURL || "");
  }, [profile]);

  if (!isDeveloper(profile) || !user) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Sign in as a developer to view this profile.
      </p>
    );
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!user || !isDeveloper(profile)) return;
    const name = displayName.trim();
    if (!name) {
      setError("Display name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const photo = photoURL.trim() || null;
      await updateProfile(user, {
        displayName: name,
        photoURL: photo || undefined,
      });
      await setDoc(
        doc(getClientDb(), "users", user.uid),
        {
          displayName: name,
          orgName: orgName.trim() || "UGNAI Developers",
          photoURL: photo,
          updatedAt: new Date().toISOString(),
          updatedAtServer: serverTimestamp(),
        },
        { merge: true },
      );
      await refreshProfile();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Profile
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Your developer account. Email and role stay fixed.
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-white px-4 py-4 shadow-sm">
        <ProfileAvatar
          name={displayName || profile.displayName}
          photoURL={photoURL || profile.photoURL}
          size="lg"
        />
        <div className="min-w-0">
          <p className="font-medium text-[var(--foreground)]">
            {displayName || profile.displayName}
          </p>
          <p className="font-mono text-[11px] text-[var(--muted)]">
            {profile.email}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Role · developer
            {orgName ? ` · ${orgName}` : ""}
          </p>
        </div>
      </div>

      <form
        onSubmit={onSave}
        className="space-y-4 rounded-xl border border-[var(--border)] bg-white px-4 py-5 shadow-sm sm:px-5"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Display name
          </span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={busy}
            maxLength={80}
            aria-invalid={!!error}
            aria-describedby={error ? "profile-form-error" : undefined}
            className="w-full border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]"
            required
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Title / org line
          </span>
          <input
            type="text"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            disabled={busy}
            maxLength={120}
            placeholder="Nexora Labs · Fullstack Engineer"
            className="w-full border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">
            Photo URL (optional)
          </span>
          <input
            type="url"
            value={photoURL}
            onChange={(e) => setPhotoURL(e.target.value)}
            disabled={busy}
            placeholder="https://…"
            className="w-full border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#1d4ed8]"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">Email</span>
          <input
            type="email"
            value={profile.email}
            disabled
            className="w-full border border-[var(--border)] bg-[#f7f8fa] px-3 py-2.5 text-sm text-[var(--muted)]"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-[var(--muted)]">UID</span>
          <input
            type="text"
            value={profile.uid}
            disabled
            className="w-full border border-[var(--border)] bg-[#f7f8fa] px-3 py-2.5 font-mono text-xs text-[var(--muted)]"
          />
        </label>

        {error ? (
          <p
            id="profile-form-error"
            className="text-sm text-[var(--danger)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="text-sm text-[#16794c]" role="status">
            Profile saved.
          </p>
        ) : null}

        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </Button>
      </form>
    </div>
  );
}
