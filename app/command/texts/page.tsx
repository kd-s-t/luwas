"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function RedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(q ? `/command/email?${q}` : "/command/email");
  }, [router, searchParams]);

  return (
    <p className="p-6 text-sm text-[var(--muted)]">Opening templates…</p>
  );
}

/** Texts live beside email on /command/email — keep this path as a redirect. */
export default function CommandTextsRedirectPage() {
  return (
    <Suspense fallback={null}>
      <RedirectInner />
    </Suspense>
  );
}
