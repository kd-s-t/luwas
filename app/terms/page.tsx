import Link from "next/link";
import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";

export default function TermsPage() {
  return (
    <PublicShell>
      <PublicPageHeader
        eyebrow="Legal"
        title="Terms"
        description="Terms of use for LUWAS: command center, citizen reports, voice notes, AI triage, and the Odette simulation."
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-sm leading-relaxed text-[var(--muted)] sm:px-6">
        <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
          Last updated · 13 Oct 2026
        </p>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Acceptance
          </h2>
          <p>
            By using LUWAS (web or Citizen iOS) you agree to these terms. The
            product is provided by{" "}
            <Link
              href="/about"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              UgnAI Labs Co.
            </Link>{" "}
            for training, coordination, and operational support - not as a
            substitute for official emergency channels. Call 911 / local
            hotlines when life is at risk.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Accounts &amp; guests
          </h2>
          <p>
            Officers and registered citizens are responsible for accurate
            details and activity under their login. New accounts may stay{" "}
            <strong className="font-medium text-[var(--foreground)]">
              pending
            </strong>{" "}
            until an active officer approves them (citizens may auto-activate
            when matched to a house-owner roster). Guests may post a field
            report without signing in; keep your report reference to track
            status. Demo buttons on{" "}
            <Link
              href="/login"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              officer
            </Link>{" "}
            and{" "}
            <Link
              href="/login/citizen"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              citizen
            </Link>{" "}
            login may create or reuse sample accounts for authorized demos and
            training - do not use them to impersonate real LGU staff outside a
            drill. Do not share credentials. False hazard reports or misuse of
            ID verification may lead to suspension.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Field content
          </h2>
          <p>
            You retain rights to media you upload and grant LUWAS a license to
            store, display, and process it for DRRM workflows: AI validation
            (Gemini and Vertex vision when configured), optional voice
            transcription, officer review (queued → validating → legit /
            rejected / needs review / failed), public feed when published, and
            optional export into labeled training batches for improving the
            vision model. Post via{" "}
            <Link
              href="/report-incident"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Post a report
            </Link>{" "}
            or the Citizen app. Optional voice notes may be stored and
            transcribed for officers. Do not upload unlawful, misleading, or
            unrelated personal content.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Officer tools
          </h2>
          <p>
            Command features (field reports, Vertex month export, house owners,
            users, roles, support tickets, notifications, SMS / email / voice
            alerts, Mangluluwas triage) are for authorized barangay staff. Scope
            is limited to onboarded / assigned areas (e.g. Brgy. Nangka). Roster
            and alert actions in the Odette simulation are for demo and training
            unless your LGU deploys LUWAS for live ops. Never auto-dial 911 from
            LUWAS; responder calls are officer-triggered to curated numbers when
            Twilio is configured.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            AI triage &amp; map assist
          </h2>
          <p>
            Running triage (chat or automatic During-phase assist) may paint AI
            flood footprints, evacuate / prepare priorities, and escape lines.
            AI map paint for flood footprints and escape routing is intended for
            the Odette{" "}
            <strong className="font-medium text-[var(--foreground)]">
              During
            </strong>{" "}
            phase; Before / After use scenario packs without that overlay.
            Escape suggestions prefer dry designated evacuation centers over
            shelters inside predicted inundation. Outputs can be wrong - flooded
            roads, EC capacity, and timing change faster than the map. Officers
            remain responsible for verification before directing households.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            AI &amp; Google services
          </h2>
          <p>
            LUWAS uses Google AI and Cloud services (including Gemini, Vertex
            AI, Firebase, and Maps / Weather / Elevation) to assist validation
            and command decisions. Model outputs can be wrong. Officers remain
            responsible for verification before acting. Vertex prediction
            endpoints and training jobs may incur Google Cloud charges when
            enabled; leaving a prediction endpoint running bills by the hour.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            No emergency guarantee
          </h2>
          <p>
            Maps, weather, AI suggestions, trust scores, flood footprints,
            escape routes, and the Odette Before / During / After simulation can
            be incomplete or delayed. LUWAS will not present unverified rescue
            or aid as confirmed. Always follow LGU, barangay, PAGASA, and other
            official instructions during hazards.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Changes
          </h2>
          <p>
            We may update these terms as the product evolves. Continued use
            after changes means you accept the revised terms. For product
            issues, email{" "}
            <a
              href="mailto:support@luwasph.com"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              support@luwasph.com
            </a>{" "}
            or see{" "}
            <Link
              href="/support"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Support
            </Link>
            . Privacy details are in{" "}
            <Link
              href="/privacy"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Privacy
            </Link>
            .
          </p>
        </section>
      </main>
    </PublicShell>
  );
}
