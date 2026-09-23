"use client";

import { createContext, use, useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { intlLocales, localeDocumentTitles, type IntlLocale, type Locale } from "./catalog";
import { createLocaleStore, LOCALE_STORAGE_KEY } from "./locale-store";

const localeEvent = "akim-locale-change";
const localeStore = createLocaleStore(() => window.localStorage);

type LocaleContextValue = {
  readonly locale: Locale;
  readonly intlLocale: IntlLocale;
  readonly setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function subscribe(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== LOCALE_STORAGE_KEY) return;
    localeStore.useStorageSnapshot();
    onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(localeEvent, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(localeEvent, onStoreChange);
  };
}

export function LocaleProvider({ children }: { readonly children: ReactNode }) {
  const locale = useSyncExternalStore<Locale>(subscribe, localeStore.getSnapshot, () => "ru");
  const setLocale = useCallback((nextLocale: Locale) => {
    localeStore.setLocale(nextLocale);
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
