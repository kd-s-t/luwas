"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { SupportBoard } from "@/components/SupportBoard";

export default function CommandSupportPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell fill>
        <SupportBoard />
      </CommandShell>
    </AuthGate>
  );
}
