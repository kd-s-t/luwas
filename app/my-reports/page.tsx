"use client";

import { AuthGate } from "@/components/AuthGate";
import { CitizenReportsList } from "@/components/CitizenReportsList";
import { CommandHeader } from "@/components/CommandHeader";
import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen, isOfficer } from "@/lib/auth/types";

/** My reports — filed field reports for the signed-in citizen or officer. */
export default function MyReportsPage() {
  const { profile } = useAuth();

  const subtitle = profile
    ? [
        profile.displayName,
        isCitizen(profile) ? profile.purok : null,
        isOfficer(profile) ? profile.orgName : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  const list = profile ? (
    <div id="my-reports">
      <CitizenReportsList citizenUid={profile.uid} />
    </div>
  ) : null;

  return (
    <AuthGate mode="protected">
      {isOfficer(profile) ? (
        <div className="min-h-screen">
          <CommandHeader />
          <main className="mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-6">
            <div className="mb-6">
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
                My reports
              </h1>
              {subtitle ? (
                <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
              ) : null}
            </div>
            {list}
          </main>
        </div>
      ) : (
        <PublicShell hideFooter>
          <PublicPageHeader
            eyebrow="Citizen"
            title="My reports"
            description={subtitle}
          />
          <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">{list}</main>
        </PublicShell>
      )}
    </AuthGate>
  );
}
