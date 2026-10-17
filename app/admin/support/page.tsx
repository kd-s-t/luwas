"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { MySupportTickets } from "@/components/MySupportTickets";

/** Officer: track support tickets you filed (devs triage on /dev/support). */
export default function AdminMySupportPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell>
        <main className="mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="mb-6">
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Help
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
              My support tickets
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Track bugs you filed. UGNAI developers triage the queue.
            </p>
          </div>
          <MySupportTickets detailBase="/admin/support" />
        </main>
      </CommandShell>
    </AuthGate>
  );
}
