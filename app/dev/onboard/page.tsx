"use client";

import { AuthGate } from "@/components/AuthGate";
import { BarangayOnboardWizard } from "@/components/BarangayOnboardWizard";
import { DeveloperShell } from "@/components/DeveloperShell";
import { FadeIn } from "@/components/motion/primitives";

export default function DeveloperOnboardPage() {
  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell>
        <FadeIn delay={0.04} y={10}>
          <div className="mx-auto max-w-3xl">
            <BarangayOnboardWizard defaultOrgName="LUWAS Developers" />
          </div>
        </FadeIn>
      </DeveloperShell>
    </AuthGate>
  );
}
