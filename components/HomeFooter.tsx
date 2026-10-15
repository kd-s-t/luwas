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
    name: "Vertex AI",
    href: "https://cloud.google.com/vertex-ai",
    role: "Vision learning",
    src: "/brands/vertex-ai.svg",
  },
  {
    name: "BigQuery",
    href: "https://cloud.google.com/bigquery",
    role: "Incident warehouse",
    src: "/brands/bigquery.png",
  },
  {
    name: "Earth Engine",
    href: "https://earthengine.google.com/",
    role: "Geospatial intel",
    src: "/brands/earth-engine.webp",
  },
  {
    name: "Google Weather",
    href: "https://developers.google.com/maps/documentation/weather",
    role: "Live conditions",
    src: "/brands/google-weather.png",
  },
  {
    name: "Google Maps",
    href: "https://developers.google.com/maps",
    role: "Basemap",
    src: "/brands/google-maps.png",
  },
  {
    name: "Google Elevation API",
    href: "https://developers.google.com/maps/documentation/elevation",
    role: "Terrain heights",
    src: "/brands/google-elevation.jpg",
  },
  {
    name: "Firebase",
    href: "https://firebase.google.com/",
    role: "Auth & data",
    src: "/brands/firebase.png",
  },
  {
    name: "Twilio",
    href: "https://www.twilio.com/",
    role: "Text & call",
    src: "/brands/twilio.png",
  },
] as const;

const FOOTER_LINKS = [
  { href: "/reports", label: "Reports" },
  { href: "/barangays", label: "Barangays" },
  { href: "/bootstrap", label: "Bootstrap UI" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/support", label: "Support" },
  { href: "/about", label: "About us" },
] as const;

export function HomeFooter() {
  return (
    <footer className="relative z-10 mt-auto border-t border-[var(--border)] bg-[var(--surface)] px-4 py-8 pb-12 sm:px-8 sm:py-10 sm:pb-14">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <p className="font-mono text-[10px] tracking-[0.28em] text-[var(--muted)] uppercase">
          Built by
        </p>
        <Link
          href="/about"
          className="mt-3 inline-block transition hover:opacity-90"
          aria-label="About us · UgnAI Labs"
        >
          <Image
            src="/brands/ugnai-labs.png"
            alt="UgnAI Labs"
            width={202}
            height={100}
            className="h-16 w-auto object-contain sm:h-20"
          />
        </Link>
        <p className="mt-3 text-xs text-[var(--muted)]">
          ©2026{" "}
          <Link
            href="/about"
            className="underline-offset-2 transition hover:text-[var(--accent)] hover:underline"
          >
            UgnAI Labs Co.
          </Link>{" "}
          All rights reserved.
        </p>

        <nav
          aria-label="Footer"
          className="mt-6 grid w-full max-w-xs grid-cols-2 gap-x-4 gap-y-2.5 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase sm:flex sm:max-w-none sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-4 sm:gap-y-2"
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

        <ul className="mt-4 grid w-full max-w-md grid-cols-4 gap-x-3 gap-y-4 sm:flex sm:max-w-2xl sm:flex-wrap sm:items-start sm:justify-center sm:gap-x-5 sm:gap-y-5">
          {POWERED_BY.map(({ name, href, role, src }) => (
            <li key={name} className="min-w-0">
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="group inline-flex w-full flex-col items-center gap-1.5"
              >
                <span className="relative flex size-8 items-center justify-center sm:size-9">
                  {src.endsWith(".svg") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt=""
                      width={28}
                      height={28}
                      className="size-6 object-contain transition group-hover:scale-105 sm:size-7"
                    />
                  ) : (
                    <Image
                      src={src}
                      alt=""
                      width={28}
                      height={28}
                      className="size-6 object-contain transition group-hover:scale-105 sm:size-7"
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-col items-center gap-0.5 px-0.5">
                  <span className="text-center text-[10px] font-medium leading-snug text-[var(--foreground)] underline-offset-4 transition group-hover:text-[var(--accent)] group-hover:underline sm:text-xs">
                    {name}
                  </span>
                  <span className="font-mono text-[8px] tracking-wider text-[var(--muted)] uppercase">
                    {role}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
