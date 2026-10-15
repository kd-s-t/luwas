"use client";

import { AuthGate } from "@/components/AuthGate";
import { DeveloperShell } from "@/components/DeveloperShell";
import { EarthEngineAdminPanel } from "@/components/EarthEngineAdminPanel";
import { FadeIn } from "@/components/motion/primitives";

export default function DeveloperEarthEnginePage() {
  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell>
        <FadeIn delay={0.04} y={10}>
          <EarthEngineAdminPanel />
        </FadeIn>
      </DeveloperShell>
    </AuthGate>
  );
}
