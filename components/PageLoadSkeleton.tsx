import { Skeleton } from "@/components/ui/skeleton";

/** Compact full-page pulse while auth resolves on protected routes. */
export function PageLoadSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface)]">
      <div className="flex h-14 items-center gap-3 border-b border-[var(--border)] px-4 sm:px-6">
        <Skeleton className="h-6 w-16" />
        <Skeleton className="ml-auto h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <div className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full sm:col-span-2" />
        </div>
      </div>
    </div>
  );
}
