"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { DeveloperShell } from "@/components/DeveloperShell";
import { SupportBugForm } from "@/components/SupportBugForm";

/** Developer: file a support ticket from the triage workspace. */
export default function DeveloperNewSupportTicketPage() {
  const router = useRouter();

  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell>
        <main className="mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="mb-6">
            <Link
              href="/dev/support"
              className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--accent)]"
            >
              ← Support board
            </Link>
            <p className="mt-3 font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Help
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
              New ticket
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Log a bug or follow-up for the team. It shows on the support board
              like any other ticket.
            </p>
          </div>
          <SupportBugForm
            onSubmitted={() => {
              router.push("/dev/support");
            }}
          />
        </main>
      </DeveloperShell>
    </AuthGate>
  );
}
