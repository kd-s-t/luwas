import Link from "next/link";
import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";

export const metadata = {
  title: "Privacy · UGNAI",
};

export default function PrivacyPage() {
  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="Legal"
        title="Privacy"
        description="How UGNAI handles accounts, guest reports, voice notes, AI triage, and field data when a barangay or LGU subscribes."
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-sm leading-relaxed text-[var(--muted)] sm:px-6">
        <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
          Last updated · 13 Oct 2026
        </p>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Who we are
          </h2>
          <p>
            UGNAI (Unified Guidance for Needs, Alerts &amp; Incidents) is a
            commercial product owned and operated by{" "}
            <Link
              href="/about"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Nexora Labs Co.
            </Link>
            . Barangay and LGU DRRM teams use UGNAI under a paid subscription.
            Nexora Labs is not a government agency, and UGNAI is not donated or
            transferred to the Philippine government. The product includes a
            public situation map, citizen / guest reporting (web and Citizen
            iOS), officer command tools, and the Tino Before / During / After
            simulation used for training and demos (including Google AI Builder
            Cup and related pilots).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            What we collect
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong className="font-medium text-[var(--foreground)]">
                Accounts:
              </strong>{" "}
              name, email, role (citizen or officer), purok or organization,
              phone when provided, barangay / LGU / area, optional household
              link, and ID / face verification materials when you register
            </li>
            <li>
              <strong className="font-medium text-[var(--foreground)]">
                Field reports:
              </strong>{" "}
              situation text, intent (e.g. need help / report hazard), photos
              or video, optional voice notes and speech transcripts, hazard
              hint, GPS / place / landmark, mobile number when provided, and
              device / IP metadata from web or the UGNAI Citizen iOS app
            </li>
            <li>
              <strong className="font-medium text-[var(--foreground)]">
                AI signals:
              </strong>{" "}
              Gemini validation verdicts and reasons; Vertex AI vision class
              and confidence when an endpoint is configured; local-rule
              fallbacks when keys are unset; officer overrides (legit /
              rejected / needs review)
            </li>
            <li>
              <strong className="font-medium text-[var(--foreground)]">
                Map triage (Before / During):
              </strong>{" "}
              AI flood footprints from elevation and storm context, evacuate /
              prepare household priorities, and escape lines toward dry
              designated shelters (not flooded ECs when a dry option exists)
            </li>
            <li>
              Guest report reference IDs and preferred language stored on your
              device (browser localStorage or iOS UserDefaults)
            </li>
            <li>
              Officer roster and map context (house owners, safe points, EC
              occupancy reports) when you use command tools
            </li>
            <li>Support tickets and bug reports you send us</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            How we use it
          </h2>
          <p>
            Data powers the command center (validation queue, house-owner
            roster, pending registrations, support triage), citizen{" "}
            <Link
              href="/my-reports"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              My reports
            </Link>
            , public{" "}
            <Link
              href="/reports"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              community reports
            </Link>
            , AI-assisted validation, and Tino map assist (Agent Nangka). Voice
            notes may be transcribed so officers can read what was said. Photos
            may be scored by a custom Vertex vision model and reasoned over by
            Gemini. Officers may export a monthly photo batch (zip + CSV) to
            train or update that vision dataset. Alert channels may send SMS,
            email, or voice outreach to households or curated responders during
            drills when those services are configured.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Sharing &amp; processors
          </h2>
          <p>
            Field reports may be visible to officers in your barangay scope and,
            when published, on the public feed. We use Google processors such as
            Firebase (auth &amp; data), Gemini (assist, ID/face check, report
            validation, voice transcription), Vertex AI (image classification
            when an endpoint is configured), and Google Maps / Weather / Elevation APIs
            when keyed. Non-Google processors may include Twilio (SMS and
            voice) and Resend (email). Without live API keys, SMS / email /
            voice run in demo mode (logged, not delivered). Demo
            citizen and officer logins on the login pages may create or reuse
            sample accounts for training; they are not a substitute for real LGU
            credentials. We do not sell personal data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Retention on device
          </h2>
          <p>
            Guest report IDs, preferred language, and local map triage snapshots
            stay on your device until you clear site data or reinstall the app.
            Signing in links reports to your account where applicable. Server
            copies of reports, media, transcripts, and AI metadata remain until
            officers or operators remove them under LGU policy.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Your choices
          </h2>
          <p>
            You may use guest reporting without an account, register as a
            citizen or officer, or ask an officer to close a pending
            registration. Clear browser storage / app data to remove local guest
            IDs. For account or data questions, use{" "}
            <Link
              href="/support"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Support
            </Link>{" "}
            or contact Nexora Labs Co. See also{" "}
            <Link
              href="/terms"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Terms
            </Link>
            .
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Contact
          </h2>
          <p>
            Privacy questions:{" "}
            <a
              href="mailto:support@ugnaiph.com"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              support@ugnaiph.com
            </a>
            ,{" "}
            <Link
              href="/support"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Support
            </Link>
            , or Nexora Labs Co. (see{" "}
            <Link
              href="/about"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              About us
            </Link>
            ).
          </p>
        </section>
      </main>
    </PublicShell>
  );
}
