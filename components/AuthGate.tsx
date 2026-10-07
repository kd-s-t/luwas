"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

type AuthGateProps = {
  children: React.ReactNode;
  mode: "protected" | "guest";
};

export function AuthGate({ children, mode }: AuthGateProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (mode === "protected" && !user) {
      router.replace("/login");
    }
    if (mode === "guest" && user) {
      router.replace("/command");
    }
  }, [loading, mode, router, user]);

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

  return <>{children}</>;
}
