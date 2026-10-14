/**
 * Curated demo portraits served from /public/demo-avatars.
 * Prefer these over pravatar so Profile + org chart stay in sync.
 */
export const DEMO_PORTRAIT_BY_EMAIL: Record<string, string> = {
  "captain@nangka.consolacion.demo":
    "/demo-avatars/hon-ricardo-villanueva.jpg",
};

export const DEMO_PORTRAIT_BY_NAME: Record<string, string> = {
  "hon. ricardo villanueva": "/demo-avatars/hon-ricardo-villanueva.jpg",
};

export function demoPortraitUrl(opts: {
  email?: string | null;
  name?: string | null;
}): string | null {
  const email = opts.email?.trim().toLowerCase();
  if (email && DEMO_PORTRAIT_BY_EMAIL[email]) {
    return DEMO_PORTRAIT_BY_EMAIL[email]!;
  }
  const name = opts.name?.trim().toLowerCase();
  if (name && DEMO_PORTRAIT_BY_NAME[name]) {
    return DEMO_PORTRAIT_BY_NAME[name]!;
  }
  return null;
}

/** Absolute URL for Firestore / Auth (works across hosts). */
export function demoPortraitAbsoluteUrl(opts: {
  email?: string | null;
  name?: string | null;
  origin?: string;
}): string | null {
  const path = demoPortraitUrl(opts);
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const origin =
    opts.origin?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    "https://luwasph.com";
  return `${origin}${path}`;
}
