import Link from "next/link";
import Image from "next/image";
import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";
import { UGNAI_DEVELOPERS } from "@/lib/auth/ugnaiDevelopers";

const TEAM = UGNAI_DEVELOPERS;

const PILLARS = [
  {
    title: "Citizen field reports",
    body: "Photo, video, and voice notes from the street, with place pins, guest references, and a clear path into the officer validation queue.",
    image: "/reports/flood-road-chapel.png",
    alt: "Flooded road near Holy Family Chapel, Nangka",
  },
  {
    title: "AI-assisted triage",
    body: "Flood footprints, evacuate vs prepare priorities, and escape lines toward dry shelters, especially in the Tino During phase used for drills.",
    image: "/reports/landslide-bank-failure.png",
    alt: "Landslide bank failure used in field report demos",
  },
  {
    title: "Barangay command",
    body: "For paying MDRRMO customers: household roster, live situation map, Mangugnai chat, SMS / email / voice outreach, and EC occupancy under pressure.",
    image: "/reports/ec-nangka-elem-after.jpg",
    alt: "Nangka Elementary School evacuation center",
  },
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export default function AboutPage() {
  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="UgnAI Labs"
        title="About us"
        description="UGNAI is our DRRM command product. Barangays and LGUs subscribe, run ops on it, and pay UgnAI Labs."
      />
      <main className="mx-auto max-w-3xl space-y-14 px-4 py-10 text-sm leading-relaxed text-[var(--muted)] sm:px-6 sm:py-14">
        <section className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
              Who we are
            </h2>
            <Image
              src="/brands/ugnai-labs.png"
              alt="UgnAI Labs"
              width={202}
              height={100}
              className="h-14 w-auto object-contain sm:h-16"
            />
          </div>
          <div className="space-y-3">
            <p>
              <span className="text-[var(--foreground)]">UgnAI Labs Co.</span>{" "}
              builds and sells{" "}
              <span className="text-[var(--foreground)]">UGNAI</span>{" "}
              (Unified Guidance for Needs, Alerts and Incidents), a paid
              command-center product for barangay and LGU DRRM teams. We are not
              a government agency, and UGNAI is not donated or handed over to
              the Philippine government. Customers activate an area, run their
              ops on the platform, and pay us for the software and support.
            </p>
            <p>
              Our reference deployment is Brgy. Nangka, Consolacion, Cebu. The
              same product is designed so other barangays can subscribe and go
              live the same way. Under stress we keep the map clear: red means
              evacuate, yellow means prepare, blue means flood belt. Officers
              get a command map and an AI colleague (Mangugnai). Residents get
              a fast way to report what they see, including guests who only need
              a reference ID.
            </p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            What we build
          </h2>
          <ul className="space-y-8">
            {PILLARS.map((item) => (
              <li key={item.title} className="space-y-3">
                <div className="relative aspect-[16/9] w-full overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)]">
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 720px"
                  />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-[var(--foreground)]">
                    {item.title}
                  </p>
                  <p>{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <p>
            Explore the{" "}
            <Link
              href="/reports"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              public reports
            </Link>
            ,{" "}
            <Link
              href="/barangays"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              barangay directory
            </Link>
            , or sign in as{" "}
            <Link
              href="/login/citizen"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              citizen
            </Link>{" "}
            /{" "}
            <Link
              href="/login"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              officer
            </Link>
            .
          </p>
        </section>

        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
              Team
            </h2>
            <p>
              Four people shipping UGNAI together: engineering, design, QA, and
              IT application support in one loop from idea to ugnaiph.com.
            </p>
          </div>
          <ul className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {TEAM.map((person) => (
              <li key={person.slug} className="flex items-start gap-4 py-5 sm:gap-5">
                <div
                  className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-raised)] font-[family-name:var(--font-display)] text-sm font-semibold tracking-wide text-[var(--accent)] sm:size-14 sm:text-base"
                  aria-hidden
                >
                  {initials(person.name)}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <p className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide text-[var(--foreground)]">
                      {person.name}
                    </p>
                    <span className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase">
                      {person.role}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    Goes by {person.short}. {person.focus}.
                  </p>
                  <p>{person.bio}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            How we work
          </h2>
          <p>
            Design and engineering sit next to the map: Tino Before / During /
            After scenarios, elevation-aware flood footprints, and escape
            routing that prefers dry shelters. QA and IT application support
            walk the same paths a resident or MDRRMO officer would (report,
            validate, alert) before we push to production.
          </p>
          <p>
            Stack highlights include Next.js, Firebase, Google Gemini and
            Vertex AI, Google Maps / Weather / Elevation, and Twilio for outreach when
            keys are configured.
          </p>
        </section>

        <section className="space-y-3 border-t border-[var(--border)] pt-8">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Get in touch
          </h2>
          <p>
            Sales, billing, bug, or barangay activation question: email{" "}
            <a
              href="mailto:support@ugnaiph.com"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              support@ugnaiph.com
            </a>{" "}
            or use{" "}
            <Link
              href="/support"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Support
            </Link>
            . Legal details live on{" "}
            <Link
              href="/privacy"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Privacy
            </Link>{" "}
            and{" "}
            <Link
              href="/terms"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Terms
            </Link>
            .
          </p>
          <p className="text-xs">©2026 UgnAI Labs Co. All rights reserved.</p>
        </section>
      </main>
    </PublicShell>
  );
}
