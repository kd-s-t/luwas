"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { AuthCard } from "@/components/AuthCard";
import { AuthGate } from "@/components/AuthGate";
import {
  IdVerificationCapture,
  type IdCaptureState,
} from "@/components/IdVerificationCapture";
import {
  RegisterLocationFields,
  type RegisterLocation,
} from "@/components/RegisterLocationFields";
import { uploadIdentityMedia } from "@/lib/auth/idUpload";
import { useAuth } from "@/lib/auth/AuthProvider";
import { verifyIdWithApi } from "@/lib/auth/verifyIdClient";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";

export default function CitizenRegisterPage() {
  const { registerCitizen, login } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [purok, setPurok] = useState("Purok 1");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState<RegisterLocation | null>({
    areaId: "consolacion/nangka",
    barangay: "Nangka",
    lgu: "Consolacion",
    label: "Nangka · Consolacion",
  });
  const [idCapture, setIdCapture] = useState<IdCaptureState>({
    idType: "umid",
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

    if (!location) {
      setError("Choose your barangay / location.");
      return;
    }
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

      setStatus("Creating citizen account…");
      let autoValidated = false;
      try {
        const result = await registerCitizen({
          email: trimmedEmail,
          password,
          displayName: name,
          purok: purok.trim(),
          phone: phone.trim(),
          areaId: location.areaId,
          barangay: location.barangay,
          lgu: location.lgu,
          idProof: {
            idVerified: true,
            idType: verdict.idType ?? idCapture.idType,
            idConfidence: verdict.confidence,
            idReason: verdict.reason,
            idSource: verdict.source,
          },
        });
        autoValidated = result.autoValidated;
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (/email-already-in-use/i.test(message)) {
          await login(trimmedEmail, password);
          router.replace("/my-reports");
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
          /* optional path persist */
        }
      }

      router.replace(autoValidated ? "/my-reports" : "/pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      setStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthGate mode="guest">
      <AuthCard
        title="Register citizen"
        subtitle="Choose your barangay. Matching house-owner records auto-validate; otherwise an officer reviews."
        footer={
          <>
            Already registered?{" "}
            <Link
              href="/login/citizen"
              className="text-[var(--accent)] hover:underline"
            >
              Citizen login
            </Link>
            {" · "}
            <Link
              href="/register"
              className="text-[var(--accent)] hover:underline"
            >
              Choose role
            </Link>
            {" · "}
            <Link
              href="/register/officer"
              className="text-[var(--accent)] hover:underline"
            >
              Officer
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
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Purok</span>
            <input
              type="text"
              required
              value={purok}
              onChange={(e) => setPurok(e.target.value)}
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Phone</span>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+63 9…"
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            />
          </label>

          <RegisterLocationFields
            value={location}
            onChange={setLocation}
            disabled={submitting}
          />

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
