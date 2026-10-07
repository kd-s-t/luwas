"use client";

import { AuthGate } from "@/components/AuthGate";
import { CitizenReportForm } from "@/components/CitizenReportForm";
import { CitizenReportsList } from "@/components/CitizenReportsList";
import { FadeIn } from "@/components/motion/primitives";
import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen, isOfficer } from "@/lib/auth/types";

export default function CitizenPage() {
  const { profile, user } = useAuth();

  const subtitle = isCitizen(profile)
    ? `${profile.displayName} · ${profile.purok}`
    : isOfficer(profile)
      ? `${profile.displayName} · ${profile.orgName}`
      : (profile?.displayName ?? user?.email ?? "Field reports");

  return (
    <AuthGate mode="protected">
      <PublicShell hideFooter>
        <PublicPageHeader
          eyebrow="My posts"
          title="Field reports"
          description={subtitle}
          wide
        />
        <main className="mx-auto grid max-w-5xl gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:grid-cols-2">
          {profile ? (
            <>
              <FadeIn delay={0.06} y={14}>
                <CitizenReportForm author={profile} />
              </FadeIn>
              <FadeIn delay={0.12} y={14}>
                <CitizenReportsList citizenUid={profile.uid} />
              </FadeIn>
            </>
          ) : null}
        </main>
      </PublicShell>
    </AuthGate>
  );
}
