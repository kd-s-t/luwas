"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthCard } from "@/components/AuthCard";
import { AuthGate } from "@/components/AuthGate";
import {
  IdVerificationCapture,
  type IdCaptureState,
} from "@/components/IdVerificationCapture";
import { DEMO_OFFICER } from "@/lib/auth/demoAccount";
import { uploadIdentityMedia } from "@/lib/auth/idUpload";
import { useAuth } from "@/lib/auth/AuthProvider";
import { verifyIdWithApi } from "@/lib/auth/verifyIdClient";
import { getClientAuth, useEmulators } from "@/lib/firebase/client";

export default function RegisterPage() {
  const { register, login } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(
    useEmulators ? DEMO_OFFICER.displayName : "",
  );
  const [orgName, setOrgName] = useState(
    useEmulators ? DEMO_OFFICER.orgName : "",
  );
  const [email, setEmail] = useState(useEmulators ? DEMO_OFFICER.email : "");
  const [password, setPassword] = useState(
    useEmulators ? DEMO_OFFICER.password : "",
  );
  const [idCapture, setIdCapture] = useState<IdCaptureState>({
    idType: "dl",
    idFile: null,
    faceFile: null,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);

    if (!idCapture.idFile || !idCapture.faceFile) {
      setError("Capture both your ID and a face selfie to continue.");
      return;
    }

    setSubmitting(true);
    const trimmedEmail = email.trim();
    const name = displayName.trim();

    try {
      setStatus("Validating ID + face with Gemini…");
      const verdict = await verifyIdWithApi({
        idType: idCapture.idType,
        displayName: name,
        idFile: idCapture.idFile,
        faceFile: idCapture.faceFile,
      });

      if (!verdict.verified) {
        throw new Error(
          verdict.reason || "ID validation failed. Use DL, Passport, or UMID.",
        );
      }

      setStatus("Creating account…");
      try {
        await register({
          email: trimmedEmail,
          password,
          displayName: name,
          orgName: orgName.trim(),
          idProof: {
            idVerified: true,
            idType: verdict.idType ?? idCapture.idType,
            idConfidence: verdict.confidence,
            idReason: verdict.reason,
            idSource: verdict.source,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (/email-already-in-use/i.test(message)) {
          await login(trimmedEmail, password);
          router.replace("/command");
          return;
        }
        throw err;
      }

      const uid = getClientAuth().currentUser?.uid;
      if (uid && idCapture.idFile && idCapture.faceFile) {
        setStatus("Saving ID photos…");
        const [idUp, faceUp] = await Promise.all([
          uploadIdentityMedia({
            uid,
            kind: "id",
            file: idCapture.idFile,
          }),
          uploadIdentityMedia({
            uid,
            kind: "face",
            file: idCapture.faceFile,
          }),
        ]);
        // Re-register profile fields via firestore update would need allow update —
        // store paths by rewriting user doc is blocked. Keep face URL as photo via
        // a second updateProfile + we already set photo after upload through auth.
        const { updateProfile } = await import("firebase/auth");
        const { doc, updateDoc } = await import("firebase/firestore");
        const { getClientDb } = await import("@/lib/firebase/client");
        await updateProfile(getClientAuth().currentUser!, {
          photoURL: faceUp.url,
        });
        try {
          await updateDoc(doc(getClientDb(), "users", uid), {
            photoURL: faceUp.url,
            idDocumentPath: idUp.path,
            faceDocumentPath: faceUp.path,
          });
        } catch {
          /* rules may block update — profile still verified */
        }
      }

      router.replace("/command");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
      setStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGate mode="guest">
      <AuthCard
        title="Register officer"
        subtitle="ID + face check required (DL, Passport, or UMID)."
        footer={
          <>
            Already registered?{" "}
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Login
            </Link>
            {" · "}
            Citizen?{" "}
            <Link
              href="/register/citizen"
              className="text-[var(--accent)] hover:underline"
            >
              Citizen register
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Full name</span>
            <input
              type="text"
              required
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">
              Barangay / LGU / org
            </span>
            <input
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="e.g. Brgy. Nangka MDRRMO"
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/50"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">
              Password (min 6)
            </span>
            <input
              type="password"
              required
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
          </label>

          <IdVerificationCapture
            value={idCapture}
            onChange={setIdCapture}
            disabled={submitting}
          />

          {status ? (
            <p className="text-sm text-[var(--accent)]" role="status">
              {status}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--accent)] px-4 py-2.5 font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-dim)] disabled:opacity-60"
          >
            {submitting ? "Validating…" : "Verify ID & create account"}
          </button>
        </form>
      </AuthCard>
    </AuthGate>
  );
}
