"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { CommandContentSkeleton } from "@/components/PageLoadSkeleton";

function RedirectCompare() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const id = searchParams.get("rs")?.trim().toUpperCase() || "RS-001";
    router.replace(`/admin/resources/compare/${encodeURIComponent(id)}`);
  }, [router, searchParams]);
  return <CommandContentSkeleton fill />;
}

export default function AllocationCompareRedirectPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell fill>
        <Suspense fallback={<CommandContentSkeleton fill />}>
          <RedirectCompare />
        </Suspense>
      </CommandShell>
    </AuthGate>
  );
}
