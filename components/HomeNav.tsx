"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { easeOut } from "@/components/motion/primitives";
import { BrandLogo } from "@/components/BrandLogo";
import { PostReportButton } from "@/components/PostReportButton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { cn } from "@/lib/utils";

type HomeNavProps = {
  /** Float over hero (home). Solid sticky bar on other pages. */
  overlay?: boolean;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-sm";

function navLinkClass(active: boolean) {
  return cn(
    "transition",
    focusRing,
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
  const onTrackReport =
    pathname === "/track-report" || pathname.startsWith("/track-report/");
  const onEvacCenters =
    pathname === "/evac-centers" || pathname.startsWith("/evac-centers/");
  const onOverview = pathname.startsWith("/admin");
  const onReportIncident =
    pathname === "/report-incident" ||
    pathname.startsWith("/report-incident/");
  const onLogin =
    pathname === "/login" || pathname.startsWith("/login/");
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
          href="/admin/overview"
          className={navLinkClass(onOverview)}
          onClick={() => setMenuOpen(false)}
        >
          Overview
        </Link>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setMenuOpen(false);
          void logout();
        }}
        className={cn(
          "text-left text-[var(--muted)] transition hover:text-[var(--foreground)]",
          focusRing,
        )}
      >
        Logout
      </button>
    </>
  ) : (
    <>
      <Link
        href="/login"
        className={navLinkClass(onLogin)}
        onClick={() => setMenuOpen(false)}
      >
        Login
      </Link>
      <Link
        href="/register"
        className={cn(
          "rounded-xl border px-3 py-1.5 transition",
          focusRing,
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
          className={cn(
            "relative z-10 shrink-0 transition hover:opacity-90",
            focusRing,
          )}
          aria-label="UGNAI home"
        >
          <BrandLogo size={26} wordmarkClassName="text-xl" />
        </Link>

        {/* Desktop: centered CTA */}
        <PostReportButton
          active={onReportIncident}
          className="absolute left-1/2 z-10 hidden -translate-x-1/2 md:inline-flex"
        />

        {/* Desktop links */}
        <nav className="relative z-10 ml-auto hidden items-center justify-end gap-x-4 text-sm md:flex">
          <Link href="/evac-centers" className={navLinkClass(onEvacCenters)}>
            Evac centers
          </Link>
          <Link href="/reports" className={navLinkClass(onReports)}>
            Reports
          </Link>
          <Link href="/track-report" className={navLinkClass(onTrackReport)}>
            Track report
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
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)]",
              focusRing,
            )}
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
            className="absolute inset-x-3 top-full z-50 mt-1 flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm shadow-sm md:hidden"
          >
            <Link
              href="/evac-centers"
              className={navLinkClass(onEvacCenters)}
              onClick={() => setMenuOpen(false)}
            >
              Evac centers
            </Link>
            <Link
              href="/reports"
              className={navLinkClass(onReports)}
              onClick={() => setMenuOpen(false)}
            >
              Reports
            </Link>
            <Link
              href="/track-report"
              className={navLinkClass(onTrackReport)}
              onClick={() => setMenuOpen(false)}
            >
              Track report
            </Link>
            {authLinks}
          </nav>
        </>
      ) : null}
    </motion.header>
  );
}
