"use client";

import { AuthGate } from "@/components/AuthGate";
import { CommandHeader } from "@/components/CommandHeader";
import { HouseholdsPanel } from "@/components/HouseholdsPanel";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";

export default function CommandHouseholdsPage() {
  const { profile, user } = useAuth();

  return (
    <AuthGate mode="protected" role="officer">
      <div className="min-h-screen">
        <CommandHeader />
        <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
          {user ? (
            <FadeIn delay={0.06} y={12}>
              <HouseholdsPanel
                officerUid={user.uid}
                orgName={isOfficer(profile) ? profile.orgName : ""}
              />
            </FadeIn>
          ) : null}
        </main>
      </div>
    </AuthGate>
  );
}
