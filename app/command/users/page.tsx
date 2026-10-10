"use client";

import { AccountValidationPanel } from "@/components/AccountValidationPanel";
import { AuthGate } from "@/components/AuthGate";
import { BarangayUsersPanel } from "@/components/BarangayUsersPanel";
import { CommandHeader } from "@/components/CommandHeader";
import { FadeIn } from "@/components/motion/primitives";

export default function CommandUsersPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <div className="min-h-screen">
        <CommandHeader />
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
          <FadeIn delay={0.06} y={12}>
            <AccountValidationPanel />
          </FadeIn>
          <FadeIn delay={0.1} y={12}>
            <BarangayUsersPanel />
          </FadeIn>
        </main>
      </div>
    </AuthGate>
  );
}
