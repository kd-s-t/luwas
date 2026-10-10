"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Suspense } from "react";

function RedirectInner() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/bootstrap#email");
  }, [router]);

  return (
    <p className="p-6 text-sm text-[var(--muted)]">Opening templates…</p>
  );
}

/** Texts/email templates live on the UI bootstrap kit. */
export default function CommandTextsRedirectPage() {
  return (
    <Suspense fallback={null}>
      <RedirectInner />
    </Suspense>
  );
}
