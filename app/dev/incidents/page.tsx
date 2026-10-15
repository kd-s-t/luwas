"use client";

import { AuthGate } from "@/components/AuthGate";
import { DeveloperIncidentsPanel } from "@/components/DeveloperIncidentsPanel";
import { DeveloperShell } from "@/components/DeveloperShell";

export default function DeveloperIncidentsPage() {
  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell>
        <DeveloperIncidentsPanel />
      </DeveloperShell>
    </AuthGate>
  );
}
