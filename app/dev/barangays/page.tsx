"use client";

import { AuthGate } from "@/components/AuthGate";
import { DeveloperShell } from "@/components/DeveloperShell";
import { DeveloperBarangaysPanel } from "@/components/DeveloperBarangaysPanel";

export default function DeveloperBarangaysPage() {
  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell>
        <DeveloperBarangaysPanel />
      </DeveloperShell>
    </AuthGate>
  );
}
