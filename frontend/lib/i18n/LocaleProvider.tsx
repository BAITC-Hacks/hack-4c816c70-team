"use client";

import { createContext, use, useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { intlLocales, localeDocumentTitles, type IntlLocale, type Locale } from "./catalog";

const storageKey = "akim-locale";
const localeEvent = "akim-locale-change";

type LocaleContextValue = {
  readonly locale: Locale;
  readonly intlLocale: IntlLocale;
  readonly setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const isLocale = (value: string | null): value is Locale => value === "ru" || value === "kk" || value === "en";

function readLocale(): Locale {
  try {
    const saved = window.localStorage.getItem(storageKey);
    return isLocale(saved) ? saved : "ru";
  } catch {
    return "ru";
  }
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(localeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(localeEvent, onStoreChange);
  };
}

export function LocaleProvider({ children }: { readonly children: ReactNode }) {
  const locale = useSyncExternalStore<Locale>(subscribe, readLocale, () => "ru");
  const setLocale = useCallback((nextLocale: Locale) => {
    try {
      window.localStorage.setItem(storageKey, nextLocale);
    } catch {
      // Private browsing or a disabled storage must not prevent language switching.
    }
    window.dispatchEvent(new Event(localeEvent));
  }, []);

  useEffect(() => {
    const syncDocumentLanguage = () => {
      document.documentElement.lang = locale;
      document.title = localeDocumentTitles[locale];
    };
    syncDocumentLanguage();
    // Next applies static metadata during hydration. Run once after that pass so a
    // restored locale keeps the browser tab title as well as the visible UI.
    const frame = requestAnimationFrame(syncDocumentLanguage);
    return () => cancelAnimationFrame(frame);
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({ locale, intlLocale: intlLocales[locale], setLocale }), [locale, setLocale]);
  return <LocaleContext value={value}>{children}</LocaleContext>;
}

export function useLocale(): LocaleContextValue {
  const context = use(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}
