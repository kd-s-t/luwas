"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { PageLoadSkeleton } from "@/components/PageLoadSkeleton";

/** Legacy path — citizens live at /admin/citizens; officers at /admin/officers. */
export default function CommandUsersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/citizens");
  }, [router]);

  return (
    <AuthGate mode="protected" role="officer">
      <PageLoadSkeleton />
    </AuthGate>
  );
}
