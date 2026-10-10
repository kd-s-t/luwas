import en from "@/lib/citizen/messages/en.json";
import tl from "@/lib/citizen/messages/tl.json";
import ceb from "@/lib/citizen/messages/ceb.json";

export type CitizenLang = "en" | "fil" | "ceb";

const CATALOG = {
  en,
  fil: tl,
  ceb,
} as const;

type Dict = typeof en;

function dig(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

/** iOS L10n.t parity — keys like `home.tagline`. */
export function t(
  lang: CitizenLang,
  key: string,
  vars?: Record<string, string>,
): string {
  const raw =
    dig(CATALOG[lang], key) ?? dig(CATALOG.en, key) ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replaceAll(`{${k}}`, v),
    raw,
  );
}

export function catalog(lang: CitizenLang): Dict {
  return CATALOG[lang] ?? CATALOG.en;
}
