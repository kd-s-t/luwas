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
        description="Report a website bug: broken pages, login issues, map glitches, or anything that blocks LUWAS."
      />
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <p className="text-sm text-[var(--muted)]">
          Email us at{" "}
          <a
            href="mailto:support@luwasph.com"
            className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
          >
            support@luwasph.com
          </a>
          , or use the form below (sign-in optional). For life-threatening
          emergencies, call local responders. Do not wait on this form.
        </p>
        <SupportBugForm />
      </main>
    </PublicShell>
  );
}
