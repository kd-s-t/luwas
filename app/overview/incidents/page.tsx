"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { IncidentBoard } from "@/components/IncidentBoard";
import { FadeIn } from "@/components/motion/primitives";

export default function CommandIncidentsPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell fill>
        <FadeIn
          delay={0.04}
          y={0}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <IncidentBoard />
        </FadeIn>
      </CommandShell>
    </AuthGate>
  );
}
