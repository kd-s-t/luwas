"use client";

import { useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { SituationMap } from "@/components/SituationMap";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Map + Mangluluwas under the global Odette Before/During/After bar.
 * No command header — fills the remaining viewport.
 */
export default function CommandFullViewPage() {
  const { user } = useAuth();

  useEffect(() => {
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, []);

  return (
    <AuthGate mode="protected" role="officer">
      <div className="relative flex h-[calc(100dvh-2.25rem)] max-h-[calc(100dvh-2.25rem)] w-full overflow-hidden bg-[var(--background)]">
        <a
          href="/command"
          className="absolute top-2 right-3 z-[60] rounded-md border border-[var(--border)] bg-[var(--surface-raised)]/95 px-2.5 py-1 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase shadow-sm backdrop-blur hover:text-[var(--foreground)]"
        >
          Exit
        </a>
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
          {user ? (
            <SituationMap officerUid={user.uid} fullViewport />
          ) : null}
        </div>
      </div>
    </AuthGate>
  );
}
