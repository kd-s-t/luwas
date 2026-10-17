"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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

/** Login portals that only accept one role — wrong role stays on the form. */
function portalRoleMismatch(pathname: string, role: UserRole): boolean {
  if (pathname.startsWith("/login/citizen")) return role !== "citizen";
  if (pathname.startsWith("/login/officer")) return role !== "officer";
  if (pathname.startsWith("/login/developer")) return role !== "developer";
  return false;
}

export function AuthGate({
  children,
  mode,
  role,
  allowPending = false,
}: AuthGateProps) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? "";
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
      // Wait for profile so login portals can reject the wrong role
      // (citizen vs officer) before redirecting.
      if (!profile) return;
      if (portalRoleMismatch(pathname, profile.role)) return;
      if (
        isAccountPending(profile) ||
        isAccountFired(profile) ||
        profile.accountStatus === "rejected"
      ) {
        router.replace("/pending");
        return;
      }
      router.replace(homeForRole(profile.role));
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
  }, [
    mounted,
    loading,
    mode,
    router,
    user,
    profile,
    role,
    allowPending,
    pathname,
  ]);

  if (!mounted || loading) {
    return mode === "guest" ? <AuthPageSkeleton /> : <PageLoadSkeleton />;
  }

  // Keep the skeleton up while redirect effects run — never flash a blank page.
  if (mode === "protected" && !user) {
    return <PageLoadSkeleton />;
  }
  if (mode === "guest" && user && !profile) {
    return <AuthPageSkeleton />;
  }
  if (
    mode === "guest" &&
    user &&
    profile &&
    portalRoleMismatch(pathname, profile.role)
  ) {
    // Keep the login form visible while the portal signs the wrong role out.
    return <>{children}</>;
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
