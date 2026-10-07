"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/command", label: "Map", match: (p: string) => p === "/command" },
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
    href: "/barangays",
    label: "Barangays",
    match: (p: string) => p.startsWith("/barangays"),
  },
] as const;

export function CommandHeader() {
  const { profile, user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <FadeIn y={8}>
      <header className="border-b border-[var(--border)] bg-[var(--surface-raised)]/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <Link
              href="/"
              className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide sm:text-3xl"
            >
              Luwas
            </Link>
            <p className="hidden font-mono text-[9px] tracking-[0.12em] text-[var(--muted)] uppercase sm:block">
              Logistics &amp; Unified Workflow for Aid &amp; Safety
            </p>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div className="hidden sm:block">
              <p className="text-sm font-medium">
                {profile?.displayName ?? user?.email}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {isOfficer(profile) ? profile.orgName : "Officer"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
            >
              Logout
            </button>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1 border-t border-[var(--border)] px-2 sm:px-4">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "border-b-2 px-3 py-2.5 font-mono text-[10px] tracking-wider uppercase transition",
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
      </header>
    </FadeIn>
  );
}
