"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandBarangaySwitcher } from "@/components/CommandBarangaySwitcher";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const NAV = [
  {
    href: "/command",
    label: "Command center",
    match: (p: string) => p === "/command",
  },
  {
    href: "/command/reports",
    label: "Field reports",
    match: (p: string) => p.startsWith("/command/reports"),
  },
  {
    href: "/citizen",
    label: "My posts",
    match: (p: string) => p.startsWith("/citizen"),
  },
  {
    href: "/command/households",
    label: "House owners",
    match: (p: string) => p.startsWith("/command/households"),
  },
  {
    href: "/command/users",
    label: "Users",
    match: (p: string) => p.startsWith("/command/users"),
  },
  {
    href: "/barangays",
    label: "Barangays",
    match: (p: string) => p.startsWith("/barangays"),
  },
  {
    href: "/command/onboard",
    label: "Onboard",
    match: (p: string) => p.startsWith("/command/onboard"),
  },
  {
    href: "/profile",
    label: "Profile",
    match: (p: string) => p.startsWith("/profile"),
  },
] as const;

export function CommandHeader() {
  const { profile, user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <FadeIn y={8} className="relative z-20">
      <header className="border-b border-[var(--border)] bg-[var(--surface-raised)]/90 backdrop-blur">
        <div className="flex min-h-12 items-center gap-3 px-3 sm:gap-4 sm:px-5">
          <Link
            href="/"
            className="shrink-0 font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide sm:text-2xl"
          >
            LUWAS
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 border-b-2 px-2.5 py-3 font-mono text-[10px] tracking-wider uppercase transition sm:px-3",
                    active
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-3">
            <CommandBarangaySwitcher />
            <Link
              href="/profile"
              className="hidden text-right transition hover:text-[var(--accent)] lg:block"
            >
              <p className="text-sm font-medium leading-tight">
                {profile?.displayName ?? user?.email}
              </p>
              <p className="text-[11px] leading-tight text-[var(--muted)]">
                {isOfficer(profile) ? profile.orgName : "Officer"}
              </p>
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="border border-[var(--border)] px-2.5 py-1 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
    </FadeIn>
  );
}
