"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthProvider";

export function HomeNav() {
  const { user, loading, logout } = useAuth();

  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-5 sm:px-8">
      <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
        Luwas · Public
      </p>
      <nav className="flex items-center gap-4 text-sm">
        {loading ? null : user ? (
          <>
            <Link
              href="/command"
              className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              Command
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <a
              href="#live-map"
              className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              Live map
            </a>
            <Link
              href="/login"
              className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="border border-[var(--border)] px-3 py-1.5 transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            >
              Register
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
