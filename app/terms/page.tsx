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
        description="Terms of use for the Luwas barangay DRRM platform."
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-sm leading-relaxed text-[var(--muted)] sm:px-6">
        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Acceptance
          </h2>
          <p>
            By using Luwas you agree to these terms. The product is provided by
            Ugnai Labs Incorporated for training, coordination, and operational
            support—not as a substitute for official emergency channels.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Accounts
          </h2>
          <p>
            Officers and citizens are responsible for accurate registration
            details and for activity under their account. Do not share login
            credentials. Misuse of verification or false hazard reports may lead
            to account suspension.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Field content
          </h2>
          <p>
            You retain rights to media you upload, and grant Luwas a license to
            store, display, and process it for DRRM workflows and AI-assisted
            validation. Do not upload unlawful or unrelated personal content.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            No emergency guarantee
          </h2>
          <p>
            Maps, weather, AI suggestions, and the Odette simulation can be
            incomplete or delayed. Always follow LGU, barangay, PAGASA, and other
            official instructions during hazards.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Changes
          </h2>
          <p>
            We may update these terms as the product evolves. Continued use after
            changes means you accept the revised terms. For product issues, see{" "}
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
