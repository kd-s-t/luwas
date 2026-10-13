"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { PageLoadSkeleton } from "@/components/PageLoadSkeleton";

/** Field reports live on Incidents now. */
export default function CommandReportsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/overview/incidents");
  }, [router]);

  return (
    <AuthGate mode="protected" role="officer">
      <PageLoadSkeleton />
    </AuthGate>
  );
}
