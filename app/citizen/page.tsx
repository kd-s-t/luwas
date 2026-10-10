"use client";

import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { CitizenReportsList } from "@/components/CitizenReportsList";
import { CommandHeader } from "@/components/CommandHeader";
import { PublicShell } from "@/components/PublicShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen, isOfficer } from "@/lib/auth/types";

/** My reports — citizens and officers (field reports they filed). */
export default function CitizenPage() {
  const { profile } = useAuth();

  const body = (
    <main
      className={
        isOfficer(profile)
          ? "mx-auto max-w-xl px-4 py-5 sm:px-6 sm:py-6"
          : "mx-auto max-w-xl px-4 pt-8 pb-16 sm:px-6"
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
            My reports
          </h1>
          {profile ? (
            <p className="mt-1 text-sm text-[var(--muted)]">
              {profile.displayName}
              {isCitizen(profile) ? ` · ${profile.purok}` : null}
              {isOfficer(profile) ? ` · ${profile.orgName}` : null}
            </p>
          ) : null}
        </div>
        <Link
          href="/report-incident"
          className="inline-flex items-center bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-dim)]"
        >
          Post a report
        </Link>
      </div>

      {profile ? (
        <div id="my-reports" className="mt-8">
          <CitizenReportsList citizenUid={profile.uid} />
        </div>
      ) : null}
    </main>
  );

  return (
    <AuthGate mode="protected">
      {isOfficer(profile) ? (
        <div className="min-h-screen">
          <CommandHeader />
          {body}
        </div>
      ) : (
        <PublicShell hideFooter>{body}</PublicShell>
      )}
    </AuthGate>
  );
}
