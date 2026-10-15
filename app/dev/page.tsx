"use client";

import { AuthGate } from "@/components/AuthGate";
import { DeveloperShell } from "@/components/DeveloperShell";
import { DeveloperUsersPanel } from "@/components/DeveloperUsersPanel";

export default function DeveloperHomePage() {
  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell>
        <DeveloperUsersPanel />
      </DeveloperShell>
    </AuthGate>
  );
}
