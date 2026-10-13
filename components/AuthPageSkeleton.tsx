import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder matching AuthCard layout — login / register / pending loads.
 */
export function AuthPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex h-14 items-center justify-between border-b border-[var(--border)] px-4 sm:px-8">
        <Skeleton className="h-6 w-20" />
        <div className="flex gap-3">
          <Skeleton className="hidden h-4 w-16 sm:block" />
          <Skeleton className="h-4 w-14" />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center px-4 py-10">
        <div className="my-auto w-full max-w-md border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_8px_28px_rgba(31,33,38,0.06)] sm:p-8">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="mt-2 h-4 w-full max-w-[18rem]" />

          <div className="mt-6 space-y-3">
            <Skeleton className="h-3 w-36" />
            <div className="divide-y divide-[var(--border)] border border-[var(--border)]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="mt-2 h-10 w-full" />
          </div>

          <div className="mt-6 space-y-2 border-t border-[var(--border)] pt-4">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4 border-t border-[var(--border)] px-4 py-6">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}
