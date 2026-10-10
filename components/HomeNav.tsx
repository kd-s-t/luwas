"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  const onReports =
    pathname === "/reports" || pathname.startsWith("/reports/");
  const onBarangays =
    pathname === "/barangays" || pathname.startsWith("/barangays/");
  const onCommand =
    pathname === "/command" || pathname.startsWith("/command/");
  const onCitizen =
    pathname === "/my-reports" ||
    pathname.startsWith("/my-reports/") ||
    pathname === "/citizen" ||
    pathname.startsWith("/citizen/");
  const onReportIncident =
    pathname === "/report-incident" ||
    pathname.startsWith("/report-incident/");
  const onProfile =
    pathname === "/profile" || pathname.startsWith("/profile/");
  const onLoginOfficer = pathname === "/login";
  const onLoginCitizen = pathname === "/login/citizen";
  const onRegister =
    pathname === "/register" || pathname.startsWith("/register/");

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const authLinks = loading ? null : user ? (
    <>
      {role === "officer" ? (
        <Link
          href="/command"
          className={navLinkClass(onCommand)}
          onClick={() => setMenuOpen(false)}
        >
          Command
        </Link>
      ) : null}
      <Link
        href="/my-reports"
        className={navLinkClass(onCitizen)}
        onClick={() => setMenuOpen(false)}
      >
        My reports
      </Link>
      <Link
        href="/profile"
        className={navLinkClass(onProfile)}
        onClick={() => setMenuOpen(false)}
      >
        Profile
      </Link>
      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          void logout();
        }}
        className="text-left text-[var(--muted)] transition hover:text-[var(--foreground)]"
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
          onClick={() => setMenuOpen(false)}
        >
          Live map
        </a>
      ) : null}
      <Link
        href="/login"
        className={navLinkClass(onLoginOfficer)}
        onClick={() => setMenuOpen(false)}
      >
        Officer
      </Link>
      <Link
        href="/login/citizen"
        className={navLinkClass(onLoginCitizen)}
        onClick={() => setMenuOpen(false)}
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
        onClick={() => setMenuOpen(false)}
      >
        Register
      </Link>
    </>
  );

  return (
    <motion.header
      className={cn(
        "relative z-30 px-3 py-3 sm:px-8 sm:py-4",
        overlay
          ? "absolute inset-x-0 top-0 bg-transparent"
          : "sticky top-0 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur",
      )}
      initial={reduce ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: easeOut }}
    >
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="relative z-10 shrink-0 font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide text-[var(--foreground)] transition hover:text-[var(--accent)]"
        >
          LUWAS
        </Link>

        {/* Desktop: centered CTA */}
        <PostReportButton
          active={onReportIncident}
          className="absolute left-1/2 z-10 hidden -translate-x-1/2 md:inline-flex"
        />

        {/* Desktop links */}
        <nav className="relative z-10 ml-auto hidden items-center justify-end gap-x-4 text-sm md:flex">
          <Link href="/reports" className={navLinkClass(onReports)}>
            Reports
          </Link>
          <Link href="/barangays" className={navLinkClass(onBarangays)}>
            Barangays
          </Link>
          {authLinks}
        </nav>

        {/* Mobile: CTA + menu */}
        <div className="relative z-10 ml-auto flex items-center gap-2 md:hidden">
          <PostReportButton
            active={onReportIncident}
            className="shrink-0 px-2.5"
          />
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center border border-[var(--border)] text-[var(--foreground)]"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="sr-only">{menuOpen ? "Close" : "Menu"}</span>
            <span aria-hidden className="flex w-4 flex-col gap-1">
              <span
                className={cn(
                  "block h-px bg-current transition",
                  menuOpen && "translate-y-[5px] rotate-45",
                )}
              />
              <span
                className={cn(
                  "block h-px bg-current transition",
                  menuOpen && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "block h-px bg-current transition",
                  menuOpen && "-translate-y-[5px] -rotate-45",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[var(--foreground)]/20 md:hidden"
            aria-label="Dismiss menu"
            onClick={() => setMenuOpen(false)}
          />
          <nav
            id={menuId}
            className="absolute inset-x-3 top-full z-50 mt-1 flex flex-col gap-3 border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm shadow-sm md:hidden"
          >
            <Link
              href="/reports"
              className={navLinkClass(onReports)}
              onClick={() => setMenuOpen(false)}
            >
              Reports
            </Link>
            <Link
              href="/barangays"
              className={navLinkClass(onBarangays)}
              onClick={() => setMenuOpen(false)}
            >
              Barangays
            </Link>
            {authLinks}
          </nav>
        </>
      ) : null}
    </motion.header>
  );
}
