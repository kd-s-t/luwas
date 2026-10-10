import { HomeFooter } from "@/components/HomeFooter";
import { HomeNav } from "@/components/HomeNav";
import { cn } from "@/lib/utils";

type PublicShellProps = {
  children: React.ReactNode;
  className?: string;
  hideFooter?: boolean;
  /** Hide site nav — used for iOS-parity citizen flow. */
  hideNav?: boolean;
};

/** Shared chrome for public pages: sticky LUWAS nav + footer. */
export function PublicShell({
  children,
  className,
  hideFooter = false,
  hideNav = false,
}: PublicShellProps) {
  return (
    <div className={cn("flex min-h-screen flex-col", className)}>
      {hideNav ? null : <HomeNav />}
      <div className="flex-1">{children}</div>
      {hideFooter ? null : <HomeFooter />}
    </div>
  );
}

type PublicPageHeaderProps = {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** Wider title band (barangay directory). */
  wide?: boolean;
};

/** Title band under HomeNav — same pattern on reports / barangays / detail. */
export function PublicPageHeader({
  eyebrow,
  title,
  description,
  action,
  wide = false,
}: PublicPageHeaderProps) {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface-raised)]">
      <div
        className={cn(
          "mx-auto px-4 py-8 sm:px-6 sm:py-10",
          wide ? "max-w-6xl sm:px-8" : "max-w-3xl",
        )}
      >
        <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
          {eyebrow}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide sm:text-4xl">
              {title}
            </h1>
            {description ? (
              <div className="mt-2 max-w-xl text-sm text-[var(--muted)]">
                {description}
              </div>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </div>
    </header>
  );
}
