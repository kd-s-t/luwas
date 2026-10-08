"use client";

import { Suspense } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AlertTemplatesPanel } from "@/components/AlertTemplatesPanel";
import { CommandHeader } from "@/components/CommandHeader";
import { FadeIn } from "@/components/motion/primitives";

export default function CommandEmailTemplatesPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <div className="min-h-screen">
        <CommandHeader />
        <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
          <FadeIn delay={0.06} y={12}>
            <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--foreground)] sm:text-3xl">
              Email &amp; text templates
            </h1>
            <p className="mt-1.5 text-sm text-[var(--muted)]">
              Side-by-side preview — email (Resend) and SMS (Twilio) for each
              alert.
            </p>
            <div className="mt-8">
              <Suspense
                fallback={
                  <p className="text-sm text-[var(--muted)]">Loading…</p>
                }
              >
                <AlertTemplatesPanel />
              </Suspense>
            </div>
          </FadeIn>
        </main>
      </div>
    </AuthGate>
  );
}
