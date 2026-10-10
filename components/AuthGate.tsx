"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isAccountActive,
  isAccountFired,
  isAccountPending,
  type UserRole,
} from "@/lib/auth/types";

type AuthGateProps = {
  children: React.ReactNode;
  mode: "protected" | "guest";
  /** When protected, optionally require a role. */
  role?: UserRole;
  /** Allow pending accounts (default false for protected). */
  allowPending?: boolean;
};

function homeForRole(role: UserRole | undefined) {
  if (role === "citizen") return "/citizen";
  return "/command";
}

export function AuthGate({
  children,
  mode,
  role,
  allowPending = false,
}: AuthGateProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (mode === "protected" && !user) {
      router.replace(role === "citizen" ? "/login/citizen" : "/login");
      return;
    }
    if (mode === "guest" && user) {
      if (
        isAccountPending(profile) ||
        isAccountFired(profile) ||
        profile?.accountStatus === "rejected"
      ) {
        router.replace("/pending");
        return;
      }
      router.replace(homeForRole(profile?.role));
      return;
    }
    if (mode === "protected" && user && role && profile && profile.role !== role) {
      router.replace(homeForRole(profile.role));
      return;
    }
    if (
      mode === "protected" &&
      user &&
      !allowPending &&
      profile &&
      !isAccountActive(profile)
    ) {
      router.replace("/pending");
    }
  }, [loading, mode, router, user, profile, role, allowPending]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] text-[var(--muted)]">
        <p className="font-mono text-sm tracking-widest uppercase">
          Establishing link…
        </p>
      </div>
    );
  }

  if (mode === "protected" && !user) return null;
  if (mode === "guest" && user) return null;
  if (mode === "protected" && role && profile && profile.role !== role) {
    return null;
  }
  if (
    mode === "protected" &&
    !allowPending &&
    profile &&
    !isAccountActive(profile)
  ) {
    return null;
  }

  return <>{children}</>;
}
