"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { SupportBugForm } from "@/components/SupportBugForm";

/** Officer: file a support ticket without leaving command. */
export default function AdminNewSupportTicketPage() {
  const router = useRouter();

  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell>
        <main className="mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="mb-6">
            <Link
              href="/admin/support"
              className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--accent)]"
            >
              ← My support
            </Link>
            <p className="mt-3 font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Help
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
              New ticket
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Sent to UGNAI developers. You can track status under My support.
            </p>
          </div>
          <SupportBugForm
            onSubmitted={() => {
              router.push("/admin/support");
            }}
          />
        </main>
      </CommandShell>
    </AuthGate>
  );
}
