import type { Locale } from "./catalog";

export const LOCALE_STORAGE_KEY = "akim-locale";

type LocaleStorage = Pick<Storage, "getItem" | "setItem">;

const isLocale = (value: string | null): value is Locale => value === "ru" || value === "kk" || value === "en";

/**
 * A tiny external store with a volatile fallback for disabled or full storage.
 * The fallback only exists in the active tab; successful Storage writes still
 * remain the source of truth for reloads and other tabs.
 */
export function createLocaleStore(getStorage: () => LocaleStorage) {
  let fallbackLocale: Locale | null = null;

  return {
    getSnapshot(): Locale {
      if (fallbackLocale !== null) return fallbackLocale;
      try {
        const saved = getStorage().getItem(LOCALE_STORAGE_KEY);
        return isLocale(saved) ? saved : "ru";
      } catch {
        return "ru";
      }
    },
    setLocale(locale: Locale) {
      try {
        getStorage().setItem(LOCALE_STORAGE_KEY, locale);
        fallbackLocale = null;
      } catch {
        fallbackLocale = locale;
      }
    },
    useStorageSnapshot() {
      fallbackLocale = null;
    },
  };
}
