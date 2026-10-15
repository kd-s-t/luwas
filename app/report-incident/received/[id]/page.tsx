"use client";

import { use } from "react";
import Link from "next/link";
import { ReportReceived } from "@/components/ReportReceived";
import { PublicShell } from "@/components/PublicShell";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isCitizen, isOfficer } from "@/lib/auth/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

/** Confirmation screen — URL + localStorage keep the ref across refresh. */
export default function ReportReceivedPage({ params }: PageProps) {
  const { id: rawId } = use(params);
  const referenceId = decodeURIComponent(rawId || "").trim();
  const { profile, loading } = useAuth();
  const signedIn =
    !loading &&
    profile &&
    (isCitizen(profile) || isOfficer(profile));

  if (!referenceId) {
    return (
      <PublicShell hideFooter hideNav>
        <div className="min-h-screen bg-[var(--surface-raised)]">
          <main className="mx-auto max-w-md px-4 pt-10 pb-10 text-center sm:px-5">
            <p className="text-sm text-[var(--muted)]">Missing reference.</p>
            <Link
              href="/report-incident"
              className="mt-4 inline-block text-sm font-semibold text-[var(--foreground)]"
            >
              Back to report
            </Link>
          </main>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell hideFooter hideNav>
      <div className="min-h-screen bg-[var(--surface-raised)]">
        <main className="mx-auto max-w-md px-4 pt-3 pb-10 sm:px-5">
          <ReportReceived
            referenceId={referenceId}
            guest={!signedIn}
          />
        </main>
      </div>
    </PublicShell>
  );
}
