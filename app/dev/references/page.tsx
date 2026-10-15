"use client";

import { AuthGate } from "@/components/AuthGate";
import { DeveloperShell } from "@/components/DeveloperShell";
import { FadeIn } from "@/components/motion/primitives";

const PROJECT =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "nice-pen-181017";

const LINKS = [
  {
    label: "Firestore Database",
    hint: "Collections · users, reports, barangays, supportTickets",
    href: `https://console.firebase.google.com/project/${PROJECT}/firestore/databases/-default-/data`,
  },
  {
    label: "BigQuery",
    hint: "Dataset luwas · hazard_reports",
    href: `https://console.cloud.google.com/bigquery?project=${PROJECT}&ws=!1m11!1m5!4m3!1s${PROJECT}!2sluwas!3shazard_reports!23sWS_URL_PARAM!1m4!3m2!1s${PROJECT}!2sluwas!23sTREE_NODE_SELECTION`,
  },
  {
    label: "Authentication",
    hint: "Users · email/password accounts",
    href: `https://console.firebase.google.com/project/${PROJECT}/authentication/users`,
  },
  {
    label: "GCS · Cloud Storage",
    hint: "luwas-media · vision ingest labels.csv (latest)",
    href: `https://console.cloud.google.com/storage/browser/_details/luwas-media-${PROJECT}/luwas-vision-ingest/latest/labels.csv;tab=live_object?project=${PROJECT}`,
  },
  {
    label: "Storage (Firebase)",
    hint: "Media bucket and uploaded report files",
    href: `https://console.firebase.google.com/project/${PROJECT}/storage`,
  },
  {
    label: "Cloud Run · luwas",
    hint: "Prod service · asia-southeast1",
    href: `https://console.cloud.google.com/run/detail/asia-southeast1/luwas/metrics?project=${PROJECT}`,
  },
  {
    label: "Firebase project overview",
    hint: PROJECT,
    href: `https://console.firebase.google.com/project/${PROJECT}/overview`,
  },
  {
    label: "GitHub Actions",
    hint: "CI · Deploy prod → luwasph.com",
    href: "https://github.com/kd-s-t/luwas/actions",
  },
  {
    label: "Figma · Luwas Flow",
    hint: "Product / flow design",
    href: "https://www.figma.com/design/806rvmMWa5XgLcAg1t4wCb/Luwas-Flow?node-id=0-1&p=f&m=draw",
  },
] as const;

export default function DeveloperReferencesPage() {
  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell>
        <FadeIn delay={0.04} y={10}>
          <div className="space-y-4">
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
                References
              </h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                External consoles for this GCP / Firebase project. Opens in a new
                tab.
              </p>
            </div>

            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-[#f7f8fa]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--foreground)]">
                        {link.label}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {link.hint}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] tracking-wider text-[#1d4ed8] uppercase">
                      Open →
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </FadeIn>
      </DeveloperShell>
    </AuthGate>
  );
}
