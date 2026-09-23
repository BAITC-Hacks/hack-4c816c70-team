/** Сохранённое предпочтение: «Системная» выбирает light или dark по ОС. */
export type ThemePreference = "system" | "light" | "dark" | "paper";
/** Реальная палитра на <html data-theme>. */
export type ThemeName = "light" | "dark" | "paper";

export const THEME_STORAGE_KEY = "akim-theme";

const THEME_EVENT = "akim-theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function isPreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark" || value === "paper";
}

/** Хранилище может быть недоступно (приватный режим, запрет cookies). */
export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function writeThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Тема всё равно применится до перезагрузки.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function subscribeThemePreference(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function readSystemDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

export function subscribeSystemDark(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ThemeName {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

/**
 * Ранний скрипт для <head> в app/layout: ставит data-theme до первой отрисовки
 * (без вспышки неверной темы) и data-motion="ready" для появления блоков.
 * Без JS атрибутов нет: тема следует системе, все блоки видимы.
 */
export const themeBootstrapScript = `(function(){var d=document.documentElement;try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var ok=p==="light"||p==="dark"||p==="paper";d.dataset.themePreference=ok?p:"system";d.dataset.theme=ok?p:(matchMedia("${DARK_QUERY}").matches?"dark":"light");}catch(e){d.dataset.theme=matchMedia("${DARK_QUERY}").matches?"dark":"light";}d.dataset.motion="ready";})();`;
