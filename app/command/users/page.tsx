"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommandHeader } from "@/components/CommandHeader";
import { StaffDirectoryPanel } from "@/components/StaffDirectoryPanel";
import { FadeIn } from "@/components/motion/primitives";

export default function CommandUsersPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <div className="min-h-screen">
        <CommandHeader />
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
          <FadeIn delay={0.06} y={12}>
            <StaffDirectoryPanel />
          </FadeIn>
        </main>
      </div>
    </AuthGate>
  );
}
