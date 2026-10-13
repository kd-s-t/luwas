"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { PageLoadSkeleton } from "@/components/PageLoadSkeleton";

/** Legacy path — citizens live at /overview/citizens; officers at /overview/officers. */
export default function CommandUsersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/overview/citizens");
  }, [router]);

  return (
    <AuthGate mode="protected" role="officer">
      <PageLoadSkeleton />
    </AuthGate>
  );
}
