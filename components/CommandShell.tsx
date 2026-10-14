"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  AlertTriangle,
  LayoutDashboard,
  LogOut,
  Shield,
} from "lucide-react";
import { CommandBarangaySwitcher } from "@/components/CommandBarangaySwitcher";
import { CommandNotifications } from "@/components/CommandNotifications";
import {
  CommandWorkspaceProvider,
  useCommandWorkspace,
} from "@/components/CommandWorkspaceProvider";
import { PageLoadSkeleton } from "@/components/PageLoadSkeleton";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import { scopeForProfile, scopeLabel } from "@/lib/reports/barangayScope";
import { cn } from "@/lib/utils";

type NavId = "overview" | "incidents" | "activity";

type PrimaryNav = {
  id: NavId;
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  match: (pathname: string, view: string | null) => boolean;
};

const PRIMARY: PrimaryNav[] = [
  {
    id: "overview",
    href: "/admin/overview",
    label: "Overview",
    icon: LayoutDashboard,
    match: (p, view) => p === "/admin/overview" && (!view || view === "overview"),
  },
  {
    id: "incidents",
    href: "/admin/incidents",
    label: "Incidents",
    icon: AlertTriangle,
    match: (p) => p.startsWith("/admin/incidents"),
  },
  {
    id: "activity",
    href: "/admin/activity",
    label: "Activity",
    icon: Activity,
    match: (p) => p.startsWith("/admin/activity"),
  },
];

const SECONDARY: { href: string; label: string; match: (p: string) => boolean }[] =
  [
    {
      href: "/admin/households",
      label: "Home owners",
      match: (p) => p.startsWith("/admin/households"),
    },
    {
      href: "/admin/citizens",
      label: "Citizens",
      match: (p) =>
        p.startsWith("/admin/citizens") || p.startsWith("/admin/users"),
    },
    {
      href: "/admin/officers",
      label: "Officers",
      match: (p) => p.startsWith("/admin/officers"),
    },
    {
      href: "/admin/roles",
      label: "Roles",
      match: (p) => p.startsWith("/admin/roles"),
    },
    {
      href: "/admin/support",
      label: "Support",
      match: (p) => p.startsWith("/admin/support"),
    },
    {
      href: "/admin/onboard",
      label: "Onboard",
      match: (p) => p.startsWith("/admin/onboard"),
    },
  ];

type CommandShellProps = {
  children: ReactNode;
  /** Fill remaining height (map / workspace). */
  fill?: boolean;
};

function CommandShellInner({ children, fill = false }: CommandShellProps) {
  const { profile, user, logout } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const view = searchParams.get("view");
  const {
    pendingCitizenCount,
    pendingOfficerCount,
    reportQueueCount,
    supportOpenCount,
  } = useCommandWorkspace();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const reportScope = useMemo(() => scopeForProfile(profile), [profile]);
  const workspaceLine = useMemo(() => {
    if (!isOfficer(profile)) return "Municipal DRRMO workspace";
    const place = scopeLabel(reportScope);
    return `${place} · Municipal DRRMO workspace`;
  }, [profile, reportScope]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, view]);

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  const displayName = profile?.displayName ?? user?.email ?? "Officer";
  const roleLine = isOfficer(profile)
    ? profile.officerTitle || "Duty coordinator"
    : "Duty coordinator";

  const sidebar = (
    <aside className="flex h-full min-h-0 w-[15.5rem] shrink-0 flex-col bg-[#0f1b2d] text-white">
      <div className="shrink-0 border-b border-white/10 px-5 pt-6 pb-5">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-[0.08em]"
        >
          LUWAS
        </Link>
        <p className="mt-2 text-[11px] leading-snug text-white/55">
          {workspaceLine}
        </p>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain px-3 py-4">
        {PRIMARY.map((item) => {
          const active = item.match(pathname, view);
          const Icon = item.icon;
          const badge = item.id === "incidents" ? reportQueueCount : 0;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                active
                  ? "bg-white font-medium text-[#0f1b2d]"
                  : "text-white/75 hover:bg-white/8 hover:text-white",
              )}
            >
              <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
              <span className="flex-1">{item.label}</span>
              {badge > 0 ? (
                <span
                  className={cn(
                    "min-w-[1.25rem] rounded-full px-1.5 py-px text-center text-[10px] font-semibold tabular-nums",
                    active
                      ? "bg-[#0f1b2d]/10 text-[#0f1b2d]"
                      : "bg-white/15 text-white",
                  )}
                >
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : null}
            </Link>
          );
        })}

        <div className="mt-4 shrink-0 border-t border-white/10 pt-3">
          <p className="px-3 pb-1.5 font-mono text-[9px] tracking-[0.16em] text-white/35 uppercase">
            Admin
          </p>
          {SECONDARY.map((item) => {
            const active = item.match(pathname);
            const badge =
              item.href === "/admin/citizens"
                ? pendingCitizenCount
                : item.href === "/admin/officers"
                  ? pendingOfficerCount
                  : item.href === "/admin/support"
                    ? supportOpenCount
                    : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-[13px] transition",
                  active
                    ? "bg-white/12 text-white"
                    : "text-white/55 hover:bg-white/8 hover:text-white/90",
                )}
              >
                <span>{item.label}</span>
                {badge > 0 ? (
                  <span className="rounded-full bg-[#c72929] px-1.5 py-px text-[10px] font-semibold tabular-nums text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto shrink-0 space-y-3 px-3 pb-4">
        <div className="rounded-xl border border-[#2a4a7a]/50 bg-[#16325a]/80 px-3.5 py-3 text-[11px] leading-relaxed text-white/80">
          <p className="flex items-start gap-2">
            <Shield className="mt-0.5 size-3.5 shrink-0 text-[#7eb6ff]" aria-hidden />
            <span>
              Human decisions. Clear evidence. AI suggestions are drafts. Every
              commitment needs your approval.
            </span>
          </p>
        </div>

        <div className="px-1">
          <CommandBarangaySwitcher tone="dark" className="block w-full max-w-none" />
        </div>

        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <ProfileAvatar
            name={displayName}
            email={profile?.email || user?.email}
            photoURL={profile?.photoURL}
            seed={displayName || profile?.email || user?.email}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <Link
              href="/profile"
              className="block truncate text-sm font-medium text-white hover:text-[#7eb6ff]"
            >
              {displayName}
            </Link>
            <p className="truncate text-[11px] text-white/45">{roleLine}</p>
          </div>
          <CommandNotifications placement="above" />
          <button
            type="button"
            onClick={() => void onLogout()}
            className="rounded-md p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white"
            aria-label="Log out"
          >
            <LogOut className="size-4" />
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

      {/* Mobile top bar */}
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
            className="rounded-md border border-white/15 px-2.5 py-1.5 font-mono text-[10px] tracking-wider uppercase"
          >
            Menu
          </button>
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-[0.08em]"
          >
            LUWAS
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <CommandNotifications />
            <CommandBarangaySwitcher />
          </div>
        </div>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/45"
              aria-label="Close menu"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 shadow-2xl">{sidebar}</div>
          </div>
        ) : null}

        <div
          className={cn(
            "min-w-0 flex-1",
            fill ? "flex min-h-0 flex-col overflow-hidden" : "",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function CommandShell(props: CommandShellProps) {
  return (
    <Suspense fallback={<PageLoadSkeleton />}>
      <CommandWorkspaceProvider>
        <CommandShellInner {...props} />
      </CommandWorkspaceProvider>
    </Suspense>
  );
}
