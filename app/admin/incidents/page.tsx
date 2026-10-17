"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { IncidentBoard } from "@/components/IncidentBoard";
import { FadeIn } from "@/components/motion/primitives";

export default function CommandIncidentsPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell>
        <FadeIn delay={0.04} y={0}>
          <IncidentBoard />
        </FadeIn>
      </CommandShell>
    </AuthGate>
  );
}
