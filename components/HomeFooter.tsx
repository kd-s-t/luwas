import Image from "next/image";
import Link from "next/link";

const POWERED_BY = [
  {
    name: "Google Gemini",
    href: "https://ai.google.dev/",
    role: "DRRM agent",
    src: "/brands/gemini.png",
  },
  {
    name: "Google Weather",
    href: "https://developers.google.com/maps/documentation/weather",
    role: "Live conditions",
    src: "/brands/google-weather.png",
  },
  {
    name: "Firebase",
    href: "https://firebase.google.com/",
    role: "Auth & data",
    src: "/brands/firebase.png",
  },
] as const;

const FOOTER_LINKS = [
  { href: "/reports", label: "Reports" },
  { href: "/barangays", label: "Barangays" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
] as const;

export function HomeFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-[var(--border)] bg-[var(--surface)] px-4 py-10 pb-14 sm:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <p className="font-mono text-[10px] tracking-[0.28em] text-[var(--muted)] uppercase">
          Built by
        </p>
        <p className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide text-[var(--foreground)]">
          Ugnai Labs Incorporated
        </p>

        <nav
          aria-label="Footer"
          className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase"
        >
          {FOOTER_LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition hover:text-[var(--accent)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <p className="mt-8 font-mono text-[10px] tracking-[0.28em] text-[var(--muted)] uppercase">
          Powered by
        </p>

        <ul className="mt-5 flex flex-wrap items-start justify-center gap-8 sm:gap-10">
          {POWERED_BY.map(({ name, href, role, src }) => (
            <li key={name}>
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex flex-col items-center gap-2"
              >
                <span className="relative flex size-12 items-center justify-center">
                  <Image
                    src={src}
                    alt=""
                    width={36}
                    height={36}
                    className="size-9 object-contain transition group-hover:scale-105"
                  />
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

        <p className="mt-8 max-w-md text-xs text-[var(--muted)]">
          Guidance for responders · not a life-safety guarantee.
        </p>
      </div>
    </footer>
  );
}
