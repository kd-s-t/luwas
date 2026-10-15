"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { AuthCard } from "@/components/AuthCard";
import { AuthGate } from "@/components/AuthGate";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  findLuwasDeveloper,
  LUWAS_DEVELOPERS,
  type LuwasDeveloper,
} from "@/lib/auth/luwasDevelopers";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";

export default function DeveloperLoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState(LUWAS_DEVELOPERS[0]!.email);
  const [password, setPassword] = useState(LUWAS_DEVELOPERS[0]!.password);
  const [selectedId, setSelectedId] = useState(LUWAS_DEVELOPERS[0]!.id);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function ensureDeveloperProfile(
    uid: string,
    member: LuwasDeveloper,
  ) {
    const ref = doc(getClientDb(), "users", uid);
    const snap = await getDoc(ref);
    const now = new Date().toISOString();
    const payload = {
      uid,
      email: member.email,
      displayName: member.name,
      role: "developer" as const,
      accountStatus: "active" as const,
      orgName: `UgnAI Labs · ${member.role}`,
      idVerified: true,
      createdAt: now,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    };
    if (snap.exists()) {
      const role = (snap.data() as { role?: string }).role;
      if (role !== "developer") {
        throw new Error("This account is not a developer.");
      }
      await setDoc(ref, payload, { merge: true });
      return;
    }
    await setDoc(ref, payload);
  }

  async function ensureDeveloperAuth(member: LuwasDeveloper) {
    try {
      await login(member.email, member.password);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const missing =
        /user-not-found|invalid-credential|INVALID_LOGIN_CREDENTIALS/i.test(
          message,
        );
      if (!missing) throw err;
      try {
        const cred = await createUserWithEmailAndPassword(
          getClientAuth(),
          member.email,
          member.password,
        );
        await updateProfile(cred.user, { displayName: member.name });
      } catch (createErr) {
        const createMsg =
          createErr instanceof Error ? createErr.message : String(createErr);
        if (/email-already-in-use/i.test(createMsg)) {
          await login(member.email, member.password);
        } else {
          throw createErr;
        }
      }
    }
    const uid = getClientAuth().currentUser?.uid;
    if (!uid) throw new Error("Sign-in failed.");
    await ensureDeveloperProfile(uid, member);
  }

  async function loginAs(member: LuwasDeveloper) {
    setSelectedId(member.id);
    setEmail(member.email);
    setPassword(member.password);
    setError(null);
    setSubmitting(true);
    try {
      await ensureDeveloperAuth(member);
      router.replace("/dev");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setSubmitting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const mail = email.trim().toLowerCase();
    const member = findLuwasDeveloper(mail, password);
    if (!member) {
      setError("Only the four LUWAS developers on About us can sign in here.");
      setSubmitting(false);
      return;
    }
    try {
      await ensureDeveloperAuth(member);
      router.replace("/dev");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setSubmitting(false);
    }
  }

  return (
    <AuthGate mode="guest">
      <AuthCard
        title="Developer login"
        subtitle="UgnAI Labs · the four people on About us."
        footer={
          <>
            <Link href="/login" className="text-[var(--accent)] hover:underline">
              Other logins
            </Link>
            {" · "}
            <Link href="/about" className="text-[var(--accent)] hover:underline">
              About us
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Developers · password demo1234
            </p>
            <ul className="divide-y divide-[var(--border)] border border-[var(--border)]">
              {LUWAS_DEVELOPERS.map((d) => {
                const selected = selectedId === d.id;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => void loginAs(d)}
                      disabled={submitting}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition disabled:opacity-60 ${
                        selected
                          ? "bg-[var(--accent)]/5"
                          : "hover:bg-[var(--surface-raised)]"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-[var(--foreground)]">
                          {d.name}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">
                          {d.role} · {d.focus}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-md px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase ${
                          selected
                            ? "bg-[var(--accent)] text-white"
                            : "border border-[var(--border)] text-[var(--muted)]"
                        }`}
                      >
                        Enter
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-[11px] text-[var(--muted)]">
              Accounts auto-create on first Enter.
            </p>
          </div>

          <div className="relative py-1">
            <div className="absolute inset-x-0 top-1/2 border-t border-[var(--border)]" />
            <p className="relative mx-auto w-fit bg-[var(--surface)] px-2 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Or email
            </p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">
              Email
            </span>
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm text-[var(--muted)]">
              Password
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
              required
            />
          </label>
          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </AuthCard>
    </AuthGate>
  );
}
