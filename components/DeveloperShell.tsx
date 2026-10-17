"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogoOnDark } from "@/components/BrandLogo";
import { DeveloperNotifications } from "@/components/DeveloperNotifications";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isDeveloper } from "@/lib/auth/types";
import { subscribeSupportTickets } from "@/lib/support/api";
import { cn } from "@/lib/utils";

const NAV: { href: string; label: string; exact?: boolean }[] = [
  { href: "/dev", label: "Users", exact: true },
  { href: "/dev/incidents", label: "Incidents" },
  { href: "/dev/barangays", label: "Operational" },
  { href: "/dev/onboard", label: "Onboard" },
  { href: "/dev/support", label: "Support" },
  { href: "/dev/roles", label: "Roles" },
  { href: "/dev/earth-engine", label: "Earth Engine" },
  { href: "/dev/flows", label: "Flows" },
  { href: "/dev/cost", label: "Cost" },
  { href: "/dev/references", label: "References" },
];

export function DeveloperShell({
  children,
  fill = false,
}: {
  children: React.ReactNode;
  fill?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, user, logout } = useAuth();
  const [supportOpen, setSupportOpen] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isDeveloper(profile) || !isAccountActive(profile)) {
      setSupportOpen(0);
      return;
    }
    return subscribeSupportTickets((rows) => {
      setSupportOpen(
        rows.filter(
          (r) => r.status === "open" || r.status === "in_progress",
        ).length,
      );
    });
  }, [profile]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  async function onLogout() {
    await logout();
    router.replace("/login/developer");
  }

  const displayName = profile?.displayName ?? user?.email ?? "Developer";

  const sidebar = (
    <aside className="flex h-full min-h-0 w-[15.5rem] shrink-0 flex-col bg-[#0f1b2d] text-white">
      <div className="shrink-0 border-b border-white/10 px-5 pt-6 pb-5">
        <Link
          href="/dev"
          className="inline-flex transition hover:opacity-90"
          aria-label="UGNAI developers"
        >
          <BrandLogoOnDark size={28} wordmarkClassName="text-2xl" />
        </Link>
        <p className="mt-2 text-[11px] leading-snug text-white/70">
          Developer console
        </p>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-3 py-4">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const badge = item.href === "/dev/support" ? supportOpen : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition",
                active
                  ? "bg-white font-medium text-[#0f1b2d]"
                  : "text-white/75 hover:bg-white/8 hover:text-white",
              )}
            >
              <span>{item.label}</span>
              {badge > 0 ? (
                <span
                  className="min-w-[1.25rem] rounded-full bg-[#c72929] px-1.5 py-px text-center text-[10px] font-semibold tabular-nums text-white"
                  aria-label={`${badge} open support tickets`}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto shrink-0 border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <Link
            href="/dev/profile"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md transition hover:bg-white/8"
          >
            <ProfileAvatar
              name={displayName}
              photoURL={isDeveloper(profile) ? profile.photoURL : null}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {displayName}
              </p>
              <p className="truncate text-[11px] text-white/70">
                {profile?.email ?? "Developer"}
              </p>
            </div>
          </Link>
          <DeveloperNotifications placement="above" tone="dark" />
          <button
            type="button"
            onClick={() => void onLogout()}
            className="rounded-md px-2 py-1 text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label="Log out"
          >
            Log out
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div
      className={cn(
        "flex bg-[#eef1f5]",
        fill
          ? "h-dvh max-h-dvh min-h-dvh overflow-hidden"
          : "min-h-dvh",
      )}
    >
      <div className="sticky top-0 hidden h-dvh shrink-0 self-start lg:flex">
        {sidebar}
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          fill && "min-h-0",
        )}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[#0f1b2d] px-3 py-2.5 text-white lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen((o) => !o)}
            className="rounded-md border border-white/15 px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-expanded={mobileNavOpen}
            aria-controls="developer-mobile-nav"
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
          >
            Menu
          </button>
          <Link href="/dev" className="inline-flex transition hover:opacity-90">
            <BrandLogoOnDark size={24} wordmarkClassName="text-lg" />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <DeveloperNotifications tone="dark" />
          </div>
        </div>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/45"
              aria-hidden
              onClick={() => setMobileNavOpen(false)}
            />
            <div
              id="developer-mobile-nav"
              className="absolute inset-y-0 left-0 shadow-2xl"
            >
              {sidebar}
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            "min-w-0 flex-1",
            fill ? "flex min-h-0 flex-col overflow-hidden" : "",
          )}
        >
          {fill ? (
            <main id="main-content" className="flex min-h-0 min-w-0 flex-1 flex-col">
              {children}
            </main>
          ) : (
            <main
              id="main-content"
              className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6"
            >
              {children}
            </main>
          )}
        </div>
      </div>
    </div>
  );
}
