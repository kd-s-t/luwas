"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommandHeader } from "@/components/CommandHeader";
import { SituationMap } from "@/components/SituationMap";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function CommandPage() {
  const { user } = useAuth();

  return (
    <AuthGate mode="protected" role="officer">
      <div className="min-h-screen">
        <CommandHeader />
        <main className="w-full pb-4 sm:pb-5">
          {user ? (
            <FadeIn delay={0.06} y={0}>
              <SituationMap officerUid={user.uid} />
            </FadeIn>
          ) : null}
        </main>
      </div>
    </AuthGate>
  );
}
