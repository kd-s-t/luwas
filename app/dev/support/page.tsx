"use client";

import { AuthGate } from "@/components/AuthGate";
import { DeveloperShell } from "@/components/DeveloperShell";
import { SupportBoard } from "@/components/SupportBoard";

export default function DeveloperSupportPage() {
  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell fill>
        <SupportBoard />
      </DeveloperShell>
    </AuthGate>
  );
}
