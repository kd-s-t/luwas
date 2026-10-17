"use client";

import { AuthGate } from "@/components/AuthGate";
import { DeveloperShell } from "@/components/DeveloperShell";
import { SupportBoard } from "@/components/SupportBoard";
import { FadeIn } from "@/components/motion/primitives";

export default function DeveloperSupportPage() {
  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell fill>
        <FadeIn delay={0.04} y={0} className="flex min-h-0 flex-1 flex-col">
          <SupportBoard />
        </FadeIn>
      </DeveloperShell>
    </AuthGate>
  );
}
