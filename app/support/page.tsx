"use client";

import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { SupportBugForm } from "@/components/SupportBugForm";

export default function SupportPage() {
  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="Help"
        title="Support"
        description="Anyone can report a bug or product issue. Tickets go to UGNAI developers."
      />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
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
        <SupportBugForm />
      </main>
    </PublicShell>
  );
}
