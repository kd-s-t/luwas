"use client";

import Link from "next/link";
import { HomeFooter } from "@/components/HomeFooter";
import { HomeNav } from "@/components/HomeNav";
import { PublicReportsFeed } from "@/components/PublicReportsFeed";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function PublicReportsPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <div className="relative border-b border-[var(--border)] bg-[var(--surface-raised)] pb-6 pt-20">
        <HomeNav />
        <FadeIn className="mx-auto max-w-3xl px-4 sm:px-6" y={10}>
          <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
            Community
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide sm:text-4xl">
            Field reports
          </h1>
          <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">
            Photos and videos from barangay residents. Anyone can view; signed-in
            users can react, comment, and delete their own comments.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {user ? (
              <Link
                href="/citizen"
                className="text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Post a report →
              </Link>
            ) : (
              <Link
                href="/login/citizen"
                className="text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Citizen login to post / comment →
              </Link>
            )}
          </div>
        </FadeIn>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <PublicReportsFeed />
      </main>

      <HomeFooter />
    </div>
  );
}
