import Link from "next/link";

type AuthCardProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <p className="font-mono text-xs tracking-[0.25em] text-[var(--accent)] uppercase">
          Command access
        </p>
        <Link
          href="/"
          className="mt-2 block font-[family-name:var(--font-display)] text-4xl font-semibold tracking-wide text-[var(--foreground)] sm:text-5xl"
        >
          Luwas
        </Link>
      </div>

      <div className="w-full max-w-md border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_8px_28px_rgba(15,42,28,0.06)]">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
        <div className="mt-6">{children}</div>
        <div className="mt-6 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
          {footer}
        </div>
      </div>
    </div>
  );
}
