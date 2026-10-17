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
import {
  formatPhMobileInput,
  toE164PhMobile,
} from "@/lib/alerts/phones";
import { notifyAccountDecision } from "@/lib/auth/notifyAccountDecision";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";

export default function CitizenRegisterPage() {
  const { registerCitizen, login } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [purok, setPurok] = useState("Purok 1");
  const [phone, setPhone] = useState("+63");
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
    const phoneE164 = toE164PhMobile(phone);
    if (!phoneE164) {
      setError("Enter a Philippine mobile number (+63 9XX XXX XXXX).");
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

      // Valid → auto-activate if homeowner match + email.
      // Invalid (Gemini fail or no match) → pending for officer call + confirm.
      setStatus(
        verdict.verified
          ? "Creating citizen account…"
          : "Gemini flagged ID — sending to officer review…",
      );
      let autoValidated = false;
      try {
        const result = await registerCitizen({
          email: trimmedEmail,
          password,
          displayName: name,
          purok: purok.trim(),
          phone: phoneE164,
          areaId: location.areaId,
          barangay: location.barangay,
          lgu: location.lgu,
          idExtractedName: verdict.extractedName,
          idProof: {
            idVerified: verdict.verified,
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
            idDocumentUrl: idUp.url,
            faceDocumentUrl: faceUp.url,
          });
        } catch {
          /* optional path persist */
        }
      }

      if (autoValidated) {
        setStatus("Valid — sending approval email…");
        void notifyAccountDecision({
          decision: "approved",
          email: trimmedEmail,
          name,
          barangay: location.barangay,
          lgu: location.lgu,
          purok: purok.trim(),
          phone: phoneE164,
        });
        router.replace("/my-reports");
      } else {
        router.replace("/pending");
      }
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
        subtitle="Register with ID. Gemini validates; if valid and on the homeowner roster you get an email. Otherwise an officer calls and confirms."
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
              aria-invalid={!!error}
              aria-describedby={error ? "register-error" : undefined}
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
            <span className="mb-1.5 block text-[var(--muted)]">
              Phone · PH mobile (+63)
            </span>
            <input
              type="tel"
              required
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhMobileInput(e.target.value))}
              onBlur={() => {
                const next = toE164PhMobile(phone);
                if (next) setPhone(next);
              }}
              placeholder="+639XXXXXXXXX"
              pattern="^\+639\d{9}$"
              title="Philippine mobile only, e.g. +639605075119"
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
              aria-invalid={!!error}
              aria-describedby={error ? "register-error" : undefined}
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
              aria-invalid={!!error}
              aria-describedby={error ? "register-error" : undefined}
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
            <p
              id="register-error"
              className="text-sm text-[var(--danger)]"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl w-full bg-[var(--accent)] px-4 py-2.5 font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-dim)] disabled:opacity-60"
          >
            {submitting ? "Validating…" : "Verify ID & create account"}
          </button>
        </form>
      </AuthCard>
    </AuthGate>
  );
}
