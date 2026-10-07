"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { easeOut } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";

export function HomeNav() {
  const { user, profile, loading, logout } = useAuth();
  const reduce = useReducedMotion();
  const role = profile?.role;

  return (
    <motion.header
      className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-5 sm:px-8"
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut }}
    >
      <p className="font-mono text-[10px] tracking-[0.22em] text-[var(--accent)] uppercase">
        Luwas
      </p>
      <nav className="flex items-center gap-4 text-sm">
        <Link
          href="/reports"
          className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          Reports
        </Link>
        <Link
          href="/barangays"
          className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          Barangays
        </Link>
        {loading ? null : user ? (
          <>
            {role === "officer" ? (
              <Link
                href="/command"
                className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                Command
              </Link>
            ) : null}
            <Link
              href="/citizen"
              className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              My posts
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
              Officer
            </Link>
            <Link
              href="/login/citizen"
              className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              Citizen
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
    </motion.header>
  );
}
