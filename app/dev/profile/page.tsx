"use client";

import { AuthGate } from "@/components/AuthGate";
import { DeveloperProfilePanel } from "@/components/DeveloperProfilePanel";
import { DeveloperShell } from "@/components/DeveloperShell";
import { FadeIn } from "@/components/motion/primitives";

export default function DeveloperProfilePage() {
  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell>
        <FadeIn delay={0.04} y={10}>
          <DeveloperProfilePanel />
        </FadeIn>
      </DeveloperShell>
    </AuthGate>
  );
}
