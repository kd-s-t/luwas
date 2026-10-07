function GeminiMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M12 2.2 13.7 8.8 20.3 10.5 13.7 12.2 12 18.8 10.3 12.2 3.7 10.5 10.3 8.8 12 2.2Z" />
      <path
        d="M18.2 14.4 19 17.1 21.7 17.9 19 18.7 18.2 21.4 17.4 18.7 14.7 17.9 17.4 17.1 18.2 14.4Z"
        opacity="0.75"
      />
    </svg>
  );
}

function WeatherMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="9" r="3.2" fill="currentColor" stroke="none" />
      <path d="M10 3.2v1.4M10 13.4v1.4M4.6 9H3.2M16.8 9h-1.4M5.7 4.7l1 1M13.3 12.3l1 1M14.3 4.7l-1 1M6.7 12.3l-1 1" />
      <path d="M8.2 16.2a4.2 4.2 0 1 0-.4 3.8h8.1a3.3 3.3 0 1 0-.4-6.5 5.2 5.2 0 0 0-7.3 2.7Z" />
    </svg>
  );
}

function FirebaseMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="currentColor"
    >
      <path d="M6.4 18.8 11.1 3.6c.2-.6 1-.7 1.3-.1l2.2 4.4-8.2 11Z" opacity="0.55" />
      <path d="m6.4 18.8 1.7-10.7c.1-.7 1-.9 1.4-.3l2.9 3.6-6 7.4Z" opacity="0.8" />
      <path d="M6.4 18.8 17.6 12c.5-.3 1.2.2 1 .8L14.8 21c-.2.4-.6.7-1.1.7H7.4c-.9 0-1.4-1-0.9-1.7l-.1-1.2Z" />
    </svg>
  );
}

const POWERED_BY = [
  {
    name: "Google Gemini",
    href: "https://ai.google.dev/",
    role: "DRRM agent",
    Logo: GeminiMark,
  },
  {
    name: "Google Weather",
    href: "https://developers.google.com/maps/documentation/weather",
    role: "Live conditions",
    Logo: WeatherMark,
  },
  {
    name: "Firebase",
    href: "https://firebase.google.com/",
    role: "Auth & data",
    Logo: FirebaseMark,
  },
] as const;

export function HomeFooter() {
  return (
    <footer className="relative z-10 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-12 sm:px-8 sm:py-14">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <p className="font-mono text-[10px] tracking-[0.28em] text-[var(--muted)] uppercase">
          Powered by
        </p>

        <ul className="mt-6 flex flex-wrap items-start justify-center gap-8 sm:gap-12">
          {POWERED_BY.map(({ name, href, role, Logo }) => (
            <li key={name}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex flex-col items-center gap-2.5"
              >
                <span className="flex size-14 items-center justify-center border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--accent)] transition group-hover:border-[var(--accent)] group-hover:bg-[var(--surface-panel)]">
                  <Logo className="size-7" />
                </span>
                <span className="flex flex-col items-center gap-0.5">
                  <span className="text-sm font-medium text-[var(--foreground)] underline-offset-4 transition group-hover:text-[var(--accent)] group-hover:underline">
                    {name}
                  </span>
                  <span className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                    {role}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        <p className="mt-10 max-w-md text-xs text-[var(--muted)]">
          Guidance for responders · not a life-safety guarantee.
        </p>
      </div>
    </footer>
  );
}
