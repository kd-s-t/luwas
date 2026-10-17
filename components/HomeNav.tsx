"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { easeOut } from "@/components/motion/primitives";
import { BrandLogo } from "@/components/BrandLogo";
import { PostReportButton } from "@/components/PostReportButton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen } from "@/lib/auth/types";
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

function citizenInitials(name: string, email?: string | null): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0]!.length >= 2) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  const e = (email || "?").trim();
  return e.slice(0, 2).toUpperCase() || "?";
}

export function HomeNav({ overlay = false }: HomeNavProps) {
  const { user, profile, loading, logout } = useAuth();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const role = profile?.role;
  const citizen = Boolean(user && isCitizen(profile));
  const displayName = profile?.displayName || user?.displayName || "";
  const email = profile?.email || user?.email || "";
  const initials = citizenInitials(displayName, email);

  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuId = useId();
  const accountId = useId();
  const accountRef = useRef<HTMLDivElement>(null);

  const onReports =
    pathname === "/reports" || pathname.startsWith("/reports/");
  const onTrackReport =
    pathname === "/track-report" || pathname.startsWith("/track-report/");
  const onEvacCenters =
    pathname === "/evac-centers" || pathname.startsWith("/evac-centers/");
  const onOverview = pathname.startsWith("/admin");
  const onMyReports =
    pathname === "/my-reports" || pathname.startsWith("/my-reports/");
  const onProfile = pathname === "/profile" || pathname.startsWith("/profile/");
  const onReportIncident =
    pathname === "/report-incident" ||
    pathname.startsWith("/report-incident/");
  const onLogin =
    pathname === "/login" || pathname.startsWith("/login/");
  const onRegister =
    pathname === "/register" || pathname.startsWith("/register/");

  useEffect(() => {
    setMenuOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen && !accountOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen, accountOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!accountRef.current?.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [accountOpen]);

  const citizenMenuItems = (
    <>
      <Link
        href="/my-reports"
        className={navLinkClass(onMyReports)}
        onClick={() => setAccountOpen(false)}
        role="menuitem"
      >
        My reports
      </Link>
      <Link
        href="/profile"
        className={navLinkClass(onProfile)}
        onClick={() => setAccountOpen(false)}
        role="menuitem"
      >
        Profile
      </Link>
      <Link
        href="/track-report"
        className={navLinkClass(onTrackReport)}
        onClick={() => setAccountOpen(false)}
        role="menuitem"
      >
        Track reports
      </Link>
      <Link
        href="/evac-centers"
        className={navLinkClass(onEvacCenters)}
        onClick={() => setAccountOpen(false)}
        role="menuitem"
      >
        Evac centers
      </Link>
      <Link
        href="/reports"
        className={navLinkClass(onReports)}
        onClick={() => setAccountOpen(false)}
        role="menuitem"
      >
        Community reports
      </Link>
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          setAccountOpen(false);
          void logout();
        }}
        className="text-left text-[var(--muted)] transition hover:text-[var(--foreground)]"
      >
        Log out
      </button>
    </>
  );

  const citizenAccountControl = !loading && citizen ? (
    <div className="relative" ref={accountRef}>
      <button
        type="button"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium tracking-wide text-white transition",
          "bg-[var(--accent)] ring-1 ring-[var(--border)] hover:bg-[var(--accent-dim)]",
          accountOpen && "ring-2 ring-[var(--accent)]",
        )}
        aria-expanded={accountOpen}
        aria-controls={accountId}
        aria-haspopup="menu"
        aria-label={
          displayName
            ? `Account menu for ${displayName}`
            : "Account menu"
        }
        onClick={() => {
          setMenuOpen(false);
          setAccountOpen((v) => !v);
        }}
      >
        <span aria-hidden>{initials}</span>
      </button>
      {accountOpen ? (
        <nav
          id={accountId}
          role="menu"
          aria-label="Citizen account"
          className="absolute right-0 top-full z-50 mt-2 flex min-w-[12.5rem] flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-sm shadow-sm"
        >
          {displayName ? (
            <p className="border-b border-[var(--border)] pb-2 text-xs text-[var(--muted)]">
              {displayName}
            </p>
          ) : null}
          {citizenMenuItems}
        </nav>
      ) : null}
    </div>
  ) : null;

  const authLinks = loading ? null : user ? (
    citizen ? null : (
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
          className="text-left text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          Logout
        </button>
      </>
    )
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

  const showMobileHamburger = !citizen;

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
          className="relative z-10 shrink-0 transition hover:opacity-90"
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
        <nav
          className={cn(
            "relative z-10 hidden items-center justify-end gap-x-4 text-sm md:flex",
            citizen ? "ml-auto mr-2" : "ml-auto",
          )}
        >
          {!citizen ? (
            <>
              <Link href="/evac-centers" className={navLinkClass(onEvacCenters)}>
                Evac centers
              </Link>
              <Link href="/reports" className={navLinkClass(onReports)}>
                Reports
              </Link>
              <Link href="/track-report" className={navLinkClass(onTrackReport)}>
                Track report
              </Link>
            </>
          ) : null}
          {authLinks}
        </nav>

        {/* Mobile: CTA + hamburger (guests/officers) */}
        <div
          className={cn(
            "relative z-10 flex items-center gap-2 md:hidden",
            citizen ? "ml-auto mr-2" : "ml-auto",
          )}
        >
          <PostReportButton
            active={onReportIncident}
            className="shrink-0 px-2.5"
          />
          {showMobileHamburger ? (
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--foreground)]"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => {
                setAccountOpen(false);
                setMenuOpen((v) => !v);
              }}
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
          ) : null}
        </div>

        {/* Citizen account — top-right on all breakpoints */}
        {citizenAccountControl ? (
          <div className="relative z-10 shrink-0">{citizenAccountControl}</div>
        ) : null}
      </div>

      {menuOpen && showMobileHamburger ? (
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
