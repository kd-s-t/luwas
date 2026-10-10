"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommandHeader } from "@/components/CommandHeader";
import { MenuRolesPanel } from "@/components/MenuRolesPanel";
import { FadeIn } from "@/components/motion/primitives";

export default function CommandRolesPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <div className="min-h-screen">
        <CommandHeader />
        <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-6">
          <FadeIn delay={0.06} y={12}>
            <MenuRolesPanel />
          </FadeIn>
        </main>
      </div>
    </AuthGate>
  );
}
