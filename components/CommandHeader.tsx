"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CommandBarangaySwitcher } from "@/components/CommandBarangaySwitcher";
import { CommandNotifications } from "@/components/CommandNotifications";
import { FadeIn } from "@/components/motion/primitives";
import {
  officerScopeBarangay,
  subscribePendingAccounts,
} from "@/lib/auth/accountValidation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isOfficer } from "@/lib/auth/types";
import { subscribeAllReports } from "@/lib/reports/api";
import {
  reportInScope,
  scopeForProfile,
} from "@/lib/reports/barangayScope";
import type { HazardReport } from "@/lib/reports/types";
import { subscribeSupportTickets } from "@/lib/support/api";
import { cn } from "@/lib/utils";

type NavBadge = "pending" | "reports" | "support" | null;

const QUEUE_STATUSES = new Set([
  "queued",
  "validating",
  "needs_review",
  "failed",
]);

const NAV: {
  href: string;
  label: string;
  short: string;
  match: (p: string) => boolean;
  badge: NavBadge;
}[] = [
  {
    href: "/command",
    label: "Command center",
    short: "Center",
    match: (p) => p === "/command",
    badge: null,
  },
  {
    href: "/command/reports",
    label: "Field reports",
    short: "Reports",
    match: (p) => p.startsWith("/command/reports"),
    badge: "reports",
  },
  {
    href: "/my-reports",
    label: "My reports",
    short: "Mine",
    match: (p) =>
      p.startsWith("/my-reports") || p.startsWith("/citizen"),
    badge: null,
  },
  {
    href: "/command/households",
    label: "House owners",
    short: "Homes",
    match: (p) => p.startsWith("/command/households"),
    badge: null,
  },
  {
    href: "/command/users",
    label: "Users",
    short: "Users",
    match: (p) => p.startsWith("/command/users"),
    badge: "pending",
  },
  {
    href: "/command/roles",
    label: "Roles",
    short: "Roles",
    match: (p) => p.startsWith("/command/roles"),
    badge: null,
  },
  {
    href: "/command/support",
    label: "Support",
    short: "Help",
    match: (p) => p.startsWith("/command/support"),
    badge: "support",
  },
  {
    href: "/barangays",
    label: "Barangays",
    short: "Brgy",
    match: (p) => p.startsWith("/barangays"),
    badge: null,
  },
  {
    href: "/command/onboard",
    label: "Onboard",
    short: "Onboard",
    match: (p) => p.startsWith("/command/onboard"),
    badge: null,
  },
];

function NavCountBadge({
  count,
  active,
  label,
}: {
  count: number;
  active: boolean;
  label: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "min-w-[1.15rem] rounded-sm px-1 py-px text-center text-[9px] font-semibold tracking-normal tabular-nums",
        active
          ? "bg-[var(--accent)] text-[var(--on-accent)]"
          : "bg-[var(--accent)]/15 text-[var(--accent)]",
      )}
      aria-label={label}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function CommandHeader() {
  const { profile, user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingCount, setPendingCount] = useState(0);
  const [reportQueueCount, setReportQueueCount] = useState(0);
  const [supportOpenCount, setSupportOpenCount] = useState(0);

  const barangay = isOfficer(profile) ? officerScopeBarangay(profile) : "";
  const areaId = isOfficer(profile)
    ? profile.areaId ?? profile.activeBarangayId
    : null;
  const reportScope = useMemo(() => scopeForProfile(profile), [profile]);

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile) || !barangay) {
      setPendingCount(0);
      return;
    }
    return subscribePendingAccounts(
      barangay,
      (rows) => setPendingCount(rows.length),
      undefined,
      areaId,
    );
  }, [profile, barangay, areaId]);

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile)) {
      setReportQueueCount(0);
      return;
    }
    return subscribeAllReports((rows: HazardReport[]) => {
      const n = rows.filter(
        (r) => reportInScope(r, reportScope) && QUEUE_STATUSES.has(r.status),
      ).length;
      setReportQueueCount(n);
    });
  }, [profile, reportScope]);

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile)) {
      setSupportOpenCount(0);
      return;
    }
    return subscribeSupportTickets((rows) => {
      setSupportOpenCount(
        rows.filter(
          (r) => r.status === "open" || r.status === "in_progress",
        ).length,
      );
    });
  }, [profile]);

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <FadeIn y={8} className="relative z-20">
      <header className="border-b border-[var(--border)] bg-[var(--surface-raised)]/90 backdrop-blur">
        <div className="flex min-h-12 items-center gap-2 px-3 sm:gap-4 sm:px-5">
          <Link
            href="/"
            className="shrink-0 font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide sm:text-2xl"
          >
            LUWAS
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV.map((item) => {
              const active = item.match(pathname);
              const badgeCount =
                item.badge === "pending"
                  ? pendingCount
                  : item.badge === "reports"
                    ? reportQueueCount
                    : item.badge === "support"
                      ? supportOpenCount
                      : 0;
              const badgeLabel =
                item.badge === "pending"
                  ? `${pendingCount} pending registrations`
                  : item.badge === "reports"
                    ? `${reportQueueCount} reports awaiting review`
                    : item.badge === "support"
                      ? `${supportOpenCount} open support tickets`
                      : "";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 border-b-2 px-2 py-3 font-mono text-[10px] tracking-wider uppercase transition sm:px-3",
                    active
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  <span className="sm:hidden">{item.short}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                  <NavCountBadge
                    count={badgeCount}
                    active={active}
                    label={badgeLabel}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <CommandNotifications />
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
              onClick={() => void onLogout()}
              className="border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)] sm:px-2.5 sm:text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
    </FadeIn>
  );
}
