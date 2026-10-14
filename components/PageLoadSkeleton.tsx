import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Main-pane pulses that match overview content width. */
export function CommandContentSkeleton({
  className,
  fill,
}: {
  className?: string;
  /** Stretch to fill a board-style pane. */
  fill?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full bg-[var(--surface)]",
        fill ? "flex min-h-0 flex-1 flex-col" : "min-h-[50dvh]",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <div className="shrink-0 space-y-3 border-b border-[var(--border)] px-4 py-4 sm:px-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-52 max-w-full" />
        <Skeleton className="h-3.5 w-72 max-w-full" />
      </div>
      <div
        className={cn(
          "grid flex-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3",
          fill && "min-h-0",
        )}
      >
        <Skeleton className="min-h-40 w-full rounded-lg" />
        <Skeleton className="min-h-40 w-full rounded-lg" />
        <Skeleton className="min-h-40 w-full rounded-lg sm:col-span-2 xl:col-span-1" />
      </div>
    </div>
  );
}

/**
 * Full-page placeholder matching CommandShell (dark nav + content).
 * Use for AuthGate and route `loading.tsx` on overview / officer pages.
 */
export function PageLoadSkeleton() {
  return (
    <div className="flex min-h-dvh bg-[#eef1f5]" aria-busy="true" aria-live="polite">
      <aside className="hidden h-dvh w-[15.5rem] shrink-0 flex-col bg-[#0f1b2d] lg:flex">
        <div className="border-b border-white/10 px-5 pt-6 pb-5">
          <Skeleton className="h-7 w-24 bg-white/15" />
          <Skeleton className="mt-3 h-3 w-36 bg-white/10" />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 px-3 py-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton
              key={`nav-${i}`}
              className="h-10 w-full rounded-lg bg-white/10"
            />
          ))}
          <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3">
            <Skeleton className="mb-2 h-2.5 w-12 bg-white/10" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton
                key={`admin-${i}`}
                className="h-8 w-full rounded-lg bg-white/8"
              />
            ))}
          </div>
        </div>
        <div className="mt-auto space-y-3 px-3 pb-4">
          <Skeleton className="h-16 w-full rounded-xl bg-white/10" />
          <Skeleton className="h-10 w-full rounded-lg bg-white/10" />
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Skeleton className="size-8 shrink-0 rounded-full bg-white/15" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-20 bg-white/15" />
              <Skeleton className="h-2.5 w-16 bg-white/10" />
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-[var(--border)] bg-[#0f1b2d] px-3 py-2.5 lg:hidden">
          <Skeleton className="h-8 w-14 rounded-md bg-white/15" />
          <Skeleton className="h-5 w-16 bg-white/15" />
          <Skeleton className="ml-auto size-8 rounded-full bg-white/15" />
        </div>
        <CommandContentSkeleton fill className="flex-1" />
      </div>
    </div>
  );
}
