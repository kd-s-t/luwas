"use client";

import { Suspense } from "react";
import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { CommandContentSkeleton } from "@/components/PageLoadSkeleton";
import { FadeIn } from "@/components/motion/primitives";
import { ResolveTransportConstraint } from "@/components/ResolveTransportConstraint";

export default function TrackDeliveryByIdPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell fill>
        <Suspense fallback={<CommandContentSkeleton fill />}>
          <FadeIn
            delay={0.04}
            y={0}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <ResolveTransportConstraint />
          </FadeIn>
        </Suspense>
      </CommandShell>
    </AuthGate>
  );
}
