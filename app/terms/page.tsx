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
        description="Terms of use for LUWAS — command center, citizen reports, and the Odette simulation."
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-sm leading-relaxed text-[var(--muted)] sm:px-6">
        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Acceptance
          </h2>
          <p>
            By using LUWAS (web or Citizen iOS) you agree to these terms. The
            product is provided by UgnAI Labs Co. for training, coordination,
            and operational support—not as a substitute for official emergency
            channels (call 911 / local hotlines when life is at risk).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Accounts & guests
          </h2>
          <p>
            Officers and registered citizens are responsible for accurate
            details and activity under their login. New accounts may stay{" "}
            <strong className="font-medium text-[var(--foreground)]">
              pending
            </strong>{" "}
            until an active officer approves them. Guests may post a field
            report without signing in; keep your report reference to track
            status. Do not share credentials. False hazard reports or misuse of
            ID verification may lead to suspension.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Field content
          </h2>
          <p>
            You retain rights to media you upload and grant LUWAS a license to
            store, display, and process it for DRRM workflows, AI validation,
            and officer review (queued · needs review · verified · rejected).
            Post via{" "}
            <Link
              href="/report-incident"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Post a report
            </Link>{" "}
            or the Citizen app. Do not upload unlawful or unrelated personal
            content.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Officer tools
          </h2>
          <p>
            Command features (field reports, house owners, users, roles,
            notifications, SMS/voice alerts) are for authorized barangay staff.
            Scope is limited to onboarded / assigned areas (e.g. Brgy. Nangka).
            Roster and alert actions in the Odette simulation are for demo and
            training unless your LGU deploys LUWAS for live ops.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            No emergency guarantee
          </h2>
          <p>
            Maps, weather, AI suggestions, trust scores, and the Odette
            Before / During / After simulation can be incomplete or delayed.
            Always follow LGU, barangay, PAGASA, and other official instructions
            during hazards.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Changes
          </h2>
          <p>
            We may update these terms as the product evolves. Continued use
            after changes means you accept the revised terms. For product
            issues, see{" "}
            <Link
              href="/support"
              className="text-[var(--accent)] underline-offset-2 hover:underline"
            >
              Support
            </Link>
            .
          </p>
        </section>
      </main>
    </PublicShell>
  );
}
