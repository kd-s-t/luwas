"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthPageSkeleton } from "@/components/AuthPageSkeleton";
import { PageLoadSkeleton } from "@/components/PageLoadSkeleton";
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
  if (role === "citizen") return "/my-reports";
  if (role === "developer") return "/dev";
  return "/admin/overview";
}

export function AuthGate({
  children,
  mode,
  role,
  allowPending = false,
}: AuthGateProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  // Keep SSR + first client paint on the skeleton so Firebase auth cannot
  // resolve to a different tree during hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || loading) return;
    if (mode === "protected" && !user) {
      router.replace(
        role === "citizen"
          ? "/login/citizen"
          : role === "developer"
            ? "/login/developer"
            : "/login/officer",
      );
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
  }, [mounted, loading, mode, router, user, profile, role, allowPending]);

  if (!mounted || loading) {
    return mode === "guest" ? <AuthPageSkeleton /> : <PageLoadSkeleton />;
  }

  // Keep the skeleton up while redirect effects run — never flash a blank page.
  if (mode === "protected" && !user) {
    return <PageLoadSkeleton />;
  }
  if (mode === "guest" && user) {
    return <AuthPageSkeleton />;
  }
  if (mode === "protected" && role && profile && profile.role !== role) {
    return <PageLoadSkeleton />;
  }
  if (
    mode === "protected" &&
    !allowPending &&
    profile &&
    !isAccountActive(profile)
  ) {
    return <PageLoadSkeleton />;
  }

  return <>{children}</>;
}
