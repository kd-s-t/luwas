"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AuthGate } from "@/components/AuthGate";
import { SituationMap } from "@/components/SituationMap";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Map + Mangugnai (Tino phase switcher lives on the map).
 * No command header — fills the viewport.
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
      <div className="relative flex h-dvh max-h-dvh w-full overflow-hidden bg-[var(--background)]">
        <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
          {user ? (
            <SituationMap
              officerUid={user.uid}
              fullViewport
              scenarioBarTrailing={
                <Link
                  href="/admin/overview"
                  className="rounded-md border border-[var(--border)] bg-[var(--surface-raised)]/95 px-2.5 py-1 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase shadow-sm backdrop-blur hover:text-[var(--foreground)]"
                >
                  Exit
                </Link>
              }
            />
          ) : null}
        </div>
      </div>
    </AuthGate>
  );
}
