"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { easeOut } from "@/components/motion/primitives";
import { PostReportButton } from "@/components/PostReportButton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils";

type HomeNavProps = {
  /** Float over hero (home). Solid sticky bar on other pages. */
  overlay?: boolean;
};

function navLinkClass(active: boolean) {
  return cn(
    "transition",
    active
      ? "font-medium text-[var(--foreground)]"
      : "text-[var(--muted)] hover:text-[var(--foreground)]",
  );
}

export function HomeNav({ overlay = false }: HomeNavProps) {
  const { user, profile, loading, logout } = useAuth();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const role = profile?.role;

  const onReports =
    pathname === "/reports" || pathname.startsWith("/reports/");
  const onBarangays =
    pathname === "/barangays" || pathname.startsWith("/barangays/");
  const onCommand =
    pathname === "/command" || pathname.startsWith("/command/");
  const onCitizen =
    pathname === "/citizen" || pathname.startsWith("/citizen/");
  const onProfile =
    pathname === "/profile" || pathname.startsWith("/profile/");
  const onLoginOfficer = pathname === "/login";
  const onLoginCitizen = pathname === "/login/citizen";
  const onRegister = pathname === "/register";

  return (
    <motion.header
      className={cn(
        "relative z-30 flex items-center justify-between px-4 py-4 sm:px-8",
        overlay
          ? "absolute inset-x-0 top-0 bg-transparent"
          : "sticky top-0 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur",
      )}
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut }}
    >
      <Link
        href="/"
        className="relative z-10 font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide text-[var(--foreground)] transition hover:text-[var(--accent)]"
      >
        Luwas
      </Link>
      <PostReportButton
        active={onCitizen}
        className="absolute left-1/2 z-10 -translate-x-1/2"
      />
      <nav className="relative z-10 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
        <Link href="/reports" className={navLinkClass(onReports)}>
          Reports
        </Link>
        <Link href="/barangays" className={navLinkClass(onBarangays)}>
          Barangays
        </Link>
        {loading ? null : user ? (
          <>
            {role === "officer" ? (
              <Link href="/command" className={navLinkClass(onCommand)}>
                Command
              </Link>
            ) : null}
            <Link href="/citizen" className={navLinkClass(onCitizen)}>
              My posts
            </Link>
            <Link href="/profile" className={navLinkClass(onProfile)}>
              Profile
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
            {overlay ? (
              <a
                href="#live-map"
                className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                Live map
              </a>
            ) : null}
            <Link href="/login" className={navLinkClass(onLoginOfficer)}>
              Officer
            </Link>
            <Link
              href="/login/citizen"
              className={navLinkClass(onLoginCitizen)}
            >
              Citizen
            </Link>
            <Link
              href="/register"
              className={cn(
                "border px-3 py-1.5 transition",
                onRegister
                  ? "border-[var(--accent)] text-[var(--foreground)]"
                  : "border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--foreground)]",
              )}
            >
              Register
            </Link>
          </>
        )}
      </nav>
    </motion.header>
  );
}
