"use client";

import { AccountValidationPanel } from "@/components/AccountValidationPanel";
import { AuthGate } from "@/components/AuthGate";
import { BarangayUsersPanel } from "@/components/BarangayUsersPanel";
import { CommandShell } from "@/components/CommandShell";
import { FadeIn } from "@/components/motion/primitives";

export default function CommandOfficersPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell>
        <main className="mx-auto max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-6">
          <FadeIn delay={0.06} y={12}>
            <AccountValidationPanel roleFilter="officer" />
          </FadeIn>
          <FadeIn delay={0.1} y={12}>
            <BarangayUsersPanel mode="officers" />
          </FadeIn>
        </main>
      </CommandShell>
    </AuthGate>
  );
}
