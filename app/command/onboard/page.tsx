"use client";

import { Suspense } from "react";
import { AuthGate } from "@/components/AuthGate";
import { BarangayOnboardWizard } from "@/components/BarangayOnboardWizard";
import { CommandHeader } from "@/components/CommandHeader";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";

export default function CommandOnboardPage() {
  const { profile } = useAuth();

  return (
    <AuthGate mode="protected" role="officer">
      <div className="min-h-dvh">
        <CommandHeader />
        <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
          <FadeIn delay={0.06} y={12}>
            <Suspense
              fallback={
                <p className="font-mono text-sm text-[var(--muted)]">
                  Loading onboarding…
                </p>
              }
            >
              <BarangayOnboardWizard
                defaultOrgName={isOfficer(profile) ? profile.orgName : ""}
              />
            </Suspense>
          </FadeIn>
        </main>
      </div>
    </AuthGate>
  );
}
