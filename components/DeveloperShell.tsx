"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogoOnDark } from "@/components/BrandLogo";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isDeveloper } from "@/lib/auth/types";
import { subscribeSupportTickets } from "@/lib/support/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dev", label: "Users", exact: true },
  { href: "/dev/barangays", label: "Operational" },
  { href: "/dev/onboard", label: "Onboard" },
  { href: "/dev/support", label: "Support" },
  { href: "/dev/roles", label: "Roles" },
  { href: "/dev/earth-engine", label: "Earth Engine" },
] as const;

export function DeveloperShell({
  children,
  fill = false,
}: {
  children: React.ReactNode;
  fill?: boolean;
}) {
  const pathname = usePathname();
  const { profile, logout } = useAuth();
  const [supportOpen, setSupportOpen] = useState(0);

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

  return (
    <div
      className={cn(
        "flex flex-col bg-[#eef1f5]",
        fill ? "h-dvh max-h-dvh overflow-hidden" : "min-h-dvh",
      )}
    >
      <header className="shrink-0 border-b border-[var(--border)] bg-[#0f1b2d] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/dev" className="inline-flex transition hover:opacity-90">
            <BrandLogoOnDark size={24} wordmarkClassName="text-lg" />
          </Link>
          <span className="font-mono text-[10px] tracking-wider text-white/45 uppercase">
            Developer
          </span>
          <nav className="ml-auto flex flex-wrap items-center gap-1">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
              const badge =
                item.href === "/dev/support" ? supportOpen : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition",
                    active
                      ? "bg-white text-[#0f1b2d]"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {item.label}
                  {badge > 0 ? (
                    <span
                      className={cn(
                        "min-w-[1.15rem] rounded-full px-1.5 py-px text-center text-[10px] font-semibold tabular-nums",
                        active
                          ? "bg-[#0f1b2d]/10 text-[#0f1b2d]"
                          : "bg-[#c72929] text-white",
                      )}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => void logout()}
              className="ml-2 rounded-md px-3 py-1.5 text-sm text-white/55 transition hover:bg-white/10 hover:text-white"
            >
              Log out
            </button>
          </nav>
        </div>
        {profile ? (
          <div className="border-t border-white/10 px-4 py-1.5 sm:px-6">
            <p className="mx-auto max-w-6xl text-[11px] text-white/45">
              {profile.displayName}
              <span className="mx-1.5 text-white/25">·</span>
              {profile.email}
            </p>
          </div>
        ) : null}
      </header>
      <main
        className={cn(
          "min-h-0 w-full flex-1",
          fill
            ? "flex flex-col overflow-hidden"
            : "mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6",
        )}
      >
        {children}
      </main>
    </div>
  );
}
