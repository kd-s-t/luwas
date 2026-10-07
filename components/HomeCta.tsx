"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

export function HomeCta() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-12 w-48 animate-pulse bg-[var(--surface-panel)]" aria-hidden />
    );
  }

  if (user) {
    return (
      <Link
        href="/command"
        className="inline-flex items-center bg-[var(--accent)] px-6 py-3 font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-dim)]"
      >
        Open command center
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/login"
        className="inline-flex items-center bg-[var(--accent)] px-6 py-3 font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-dim)]"
      >
        Officer login
      </Link>
      <Link
        href="/register"
        className="inline-flex items-center border border-[var(--border)] px-6 py-3 text-[var(--foreground)] transition hover:border-[var(--accent)]"
      >
        Register
      </Link>
    </div>
  );
}
