"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import type { UserRole } from "@/lib/auth/types";

type AuthGateProps = {
  children: React.ReactNode;
  mode: "protected" | "guest";
  /** When protected, optionally require a role. */
  role?: UserRole;
};

function homeForRole(role: UserRole | undefined) {
  if (role === "citizen") return "/citizen";
  return "/command";
}

export function AuthGate({ children, mode, role }: AuthGateProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (mode === "protected" && !user) {
      router.replace(role === "citizen" ? "/login/citizen" : "/login");
      return;
    }
    if (mode === "guest" && user) {
      router.replace(homeForRole(profile?.role));
      return;
    }
    if (mode === "protected" && user && role && profile && profile.role !== role) {
      router.replace(homeForRole(profile.role));
    }
  }, [loading, mode, router, user, profile, role]);

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

  return <>{children}</>;
}
