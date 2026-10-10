import Link from "next/link";
import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";

export default function PrivacyPage() {
  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="Legal"
        title="Privacy"
        description="How LUWAS handles account, guest reports, and field data for barangay DRRM."
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-sm leading-relaxed text-[var(--muted)] sm:px-6">
        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Who we are
          </h2>
          <p>
            LUWAS is operated by UgnAI Labs Co. for barangay and LGU disaster
            risk reduction and management (DRRM) workflows—including the Odette
            simulation used for training and demo.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            What we collect
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Account details (name, email, role, purok or organization) and
              optional ID / face verification materials
            </li>
            <li>
              Field reports — notes, media, hazard type, GPS / place labels, and
              device metadata when you post from web or the LUWAS Citizen iOS
              app
            </li>
            <li>
              Guest report reference IDs stored on your device (browser
              localStorage or iOS UserDefaults) so you can check status without
              an account
            </li>
            <li>Support messages and bug reports you send us</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            How we use it
          </h2>
          <p>
            Data runs the command center (field report queue, house-owner
            roster, pending registrations), citizen{" "}
            <Link
              href="/my-reports"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              My reports
            </Link>
            , AI-assisted validation, public situation context, and officer
            notifications. Alert channels may use SMS and voice for household or
            responder outreach during drills.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Sharing & processors
          </h2>
          <p>
            Field reports may be visible to officers in your barangay scope and,
            when published, to the community feed. We use processors such as
            Firebase (auth & data), Google Gemini (AI assist / validation), and
            Twilio (text & call) when those services are configured. Without
            live API keys, SMS/voice run in demo mode (logged, not sent). We do
            not sell personal data.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Retention on device
          </h2>
          <p>
            Guest report IDs and preferred language stay on your device until
            you clear site data or reinstall the app. Signing in links reports
            to your account where applicable.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Contact
          </h2>
          <p>
            Questions about privacy: use the{" "}
            <Link
              href="/support"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Support
            </Link>{" "}
            page or contact UgnAI Labs Co.
          </p>
        </section>
      </main>
    </PublicShell>
  );
}
