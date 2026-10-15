"use client";

import { useEffect, useState } from "react";
import type { CitizenLang } from "@/lib/citizen/i18n";

const STORAGE_KEY = "luwas.citizenLang";
const VALID = new Set<CitizenLang>(["en", "fil", "ceb"]);

export function getCitizenLang(): CitizenLang {
  if (typeof window === "undefined") return "en";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && VALID.has(raw as CitizenLang)) return raw as CitizenLang;
  } catch {
    /* ignore */
  }
  return "en";
}

export function setCitizenLang(lang: CitizenLang) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

/** SSR-safe: starts as `en`, then hydrates from localStorage. */
export function useCitizenLanguage(): [
  CitizenLang,
  (lang: CitizenLang) => void,
] {
  const [language, setLanguageState] = useState<CitizenLang>("en");

  useEffect(() => {
    setLanguageState(getCitizenLang());
  }, []);

  function setLanguage(lang: CitizenLang) {
    setLanguageState(lang);
    setCitizenLang(lang);
  }

  return [language, setLanguage];
}
