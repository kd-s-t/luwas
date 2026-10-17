"use client";

import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { MySupportTickets } from "@/components/MySupportTickets";
import { SupportBugForm } from "@/components/SupportBugForm";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import Link from "next/link";

export default function SupportPage() {
  const { user, profile } = useAuth();
  const ticketsBase =
    isOfficer(profile) ? ("/admin/support" as const) : ("/support" as const);

  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="Help"
        title="Support"
        description="Anyone can report a bug or product issue. Tickets go to UGNAI developers."
      />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6">
        <p className="text-sm text-[var(--muted)]">
          Officers, citizens, and guests use the same form. Email{" "}
          <a
            href="mailto:support@ugnaiph.com"
            className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
          >
            support@ugnaiph.com
          </a>{" "}
          or submit below (sign-in optional). For life-threatening emergencies,
          call local responders. Do not wait on this form.
        </p>

        {user ? (
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
                  My tickets
                </h2>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  Status of tickets filed with this account.
                </p>
              </div>
              {isOfficer(profile) ? (
                <Link
                  href="/admin/support"
                  className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase hover:underline"
                >
                  Open in command
                </Link>
              ) : null}
            </div>
            <MySupportTickets detailBase={ticketsBase} />
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
            Report a bug
          </h2>
          <SupportBugForm />
        </section>
      </main>
    </PublicShell>
  );
}
