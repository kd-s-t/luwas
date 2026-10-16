"use client";

import Image from "next/image";
import { AuthGate } from "@/components/AuthGate";
import { DeveloperShell } from "@/components/DeveloperShell";
import { FadeIn } from "@/components/motion/primitives";

/** Prod GCP / Firebase project (not local demo-dro). */
const PROJECT = "nice-pen-181017";

const LINKS = [
  {
    label: "Firestore",
    hint: "Database · users, reports, barangays, supportTickets",
    href: `https://console.firebase.google.com/project/${PROJECT}/firestore/databases/-default-/data`,
    logo: "/brands/firestore.png",
  },
  {
    label: "BigQuery",
    hint: "Dataset ugnai · hazard_reports",
    href: `https://console.cloud.google.com/bigquery?project=${PROJECT}&ws=!1m11!1m5!4m3!1s${PROJECT}!2sugnai!3shazard_reports!23sWS_URL_PARAM!1m4!3m2!1s${PROJECT}!2sugnai!23sTREE_NODE_SELECTION`,
    logo: "/brands/bigquery.png",
  },
  {
    label: "GCS · Cloud Storage",
    hint: "ugnai-media · vision ingest labels.csv (latest)",
    href: `https://console.cloud.google.com/storage/browser/_details/ugnai-media-${PROJECT}/luwas-vision-ingest/latest/labels.csv;tab=live_object?project=${PROJECT}`,
    logo: "/brands/gcs.png",
  },
  {
    label: "GitHub",
    hint: "kd-s-t/ugnai",
    href: "https://github.com/kd-s-t/ugnai",
    logo: "/brands/github.svg",
  },
  {
    label: "Figma · Ugnai Flow",
    hint: "Product / flow design",
    href: "https://www.figma.com/design/806rvmMWa5XgLcAg1t4wCb/Ugnai-Flow?node-id=0-1&p=f&m=draw",
    logo: "/brands/figma.png",
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
                External consoles. Opens in a new tab.
              </p>
            </div>

            <ul className="divide-y divide-[var(--border)]">
              {LINKS.map((link) => (
                <li key={link.href + link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-wrap items-center gap-3 py-3.5 transition hover:opacity-80"
                  >
                    <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden">
                      <Image
                        src={link.logo}
                        alt=""
                        width={28}
                        height={28}
                        className="size-7 object-contain"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
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
