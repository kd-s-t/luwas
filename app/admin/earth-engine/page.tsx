"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { EarthEngineAdminPanel } from "@/components/EarthEngineAdminPanel";
import { FadeIn } from "@/components/motion/primitives";

export default function CommandEarthEnginePage() {
  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell>
        <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
          <FadeIn delay={0.06} y={12}>
            <EarthEngineAdminPanel />
          </FadeIn>
        </main>
      </CommandShell>
    </AuthGate>
  );
}
