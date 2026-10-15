"use client";

import { AuthGate } from "@/components/AuthGate";
import { DeveloperShell } from "@/components/DeveloperShell";
import { MenuRolesPanel } from "@/components/MenuRolesPanel";
import { FadeIn } from "@/components/motion/primitives";

export default function DeveloperRolesPage() {
  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell>
        <FadeIn delay={0.04} y={10}>
          <MenuRolesPanel />
        </FadeIn>
      </DeveloperShell>
    </AuthGate>
  );
}
