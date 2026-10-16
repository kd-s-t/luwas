"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { EvacCentersPanel } from "@/components/EvacCentersPanel";

export default function CommandEvacCentersPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell>
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
          <EvacCentersPanel />
        </main>
      </CommandShell>
    </AuthGate>
  );
}
