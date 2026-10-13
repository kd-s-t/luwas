"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { FadeIn } from "@/components/motion/primitives";

export default function CommandActivityPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell>
        <FadeIn
          delay={0.04}
          y={0}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-20 text-center">
            <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Activity
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide sm:text-2xl">
              Nothing here yet
            </h1>
            <p className="max-w-sm text-sm text-[var(--muted)]">
              Activity feed is empty. Incidents and support stay on their own
              boards.
            </p>
          </div>
        </FadeIn>
      </CommandShell>
    </AuthGate>
  );
}
