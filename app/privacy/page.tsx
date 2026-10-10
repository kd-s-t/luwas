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
        description="How LUWAS handles account and field data for barangay DRRM use."
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-sm leading-relaxed text-[var(--muted)] sm:px-6">
        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Who we are
          </h2>
          <p>
            LUWAS is operated by UgnAI Labs Co. for barangay and LGU
            disaster risk reduction and management (DRRM) workflows.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            What we collect
          </h2>
          <p>
            Account details (name, email, role, purok or organization), optional
            ID verification materials, field report media and notes, device and
            approximate location metadata when you post, and support messages you
            send us.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            How we use it
          </h2>
          <p>
            Data is used to run the LUWAS command and citizen tools, validate
            reports, show public situation context, and respond to support
            requests. Guidance in the app is for responders.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--foreground)]">
            Sharing
          </h2>
          <p>
            Field reports you publish may be visible to the community and
            officers. We use processors such as Firebase and Google AI services
            to host and assist the product. We do not sell personal data.
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
