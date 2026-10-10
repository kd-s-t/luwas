"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommandHeader } from "@/components/CommandHeader";
import { SupportTicketsPanel } from "@/components/SupportTicketsPanel";
import { FadeIn } from "@/components/motion/primitives";

export default function CommandSupportPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <div className="min-h-screen">
        <CommandHeader />
        <main className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-6">
          <FadeIn delay={0.06} y={12}>
            <SupportTicketsPanel />
          </FadeIn>
        </main>
      </div>
    </AuthGate>
  );
}
