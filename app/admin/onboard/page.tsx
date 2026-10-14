"use client";

import { Suspense } from "react";
import { AuthGate } from "@/components/AuthGate";
import { BarangayOnboardWizard } from "@/components/BarangayOnboardWizard";
import { CommandShell } from "@/components/CommandShell";
import { CommandContentSkeleton } from "@/components/PageLoadSkeleton";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";

export default function CommandOnboardPage() {
  const { profile } = useAuth();

  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell>
        <main className="mx-auto max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
          <FadeIn delay={0.06} y={12}>
            <Suspense fallback={<CommandContentSkeleton />}>
              <BarangayOnboardWizard
                defaultOrgName={isOfficer(profile) ? profile.orgName : ""}
              />
            </Suspense>
          </FadeIn>
        </main>
      </CommandShell>
    </AuthGate>
  );
}
