"use client";

import { createContext, use, useCallback, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  readSystemDark,
  readThemePreference,
  resolveTheme,
  subscribeSystemDark,
  subscribeThemePreference,
  writeThemePreference,
  type ThemeName,
  type ThemePreference,
} from "./theme-store";

export interface ThemeContextValue {
  /** Выбор пользователя, включая «Системную». */
  readonly preference: ThemePreference;
  /** Применённая палитра. */
  readonly theme: ThemeName;
  readonly setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const serverPreference = (): ThemePreference => "system";
const serverSystemDark = () => false;

export interface ThemeProviderProps {
  readonly children: ReactNode;
}

/**
 * Хранит предпочтение под ключом akim-theme и ставит data-theme на <html>.
 * Первая отрисовка совпадает с сервером; реальное значение подставляется
 * сразу после гидрации, а ранний bootstrap-скрипт уже применил цвета.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const preference = useSyncExternalStore(subscribeThemePreference, readThemePreference, serverPreference);
  const systemDark = useSyncExternalStore(subscribeSystemDark, readSystemDark, serverSystemDark);
  const theme = resolveTheme(preference, systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolveTheme(readThemePreference(), readSystemDark());
    root.dataset.themePreference = readThemePreference();
  }, [theme, preference]);

  const setPreference = useCallback((next: ThemePreference) => writeThemePreference(next), []);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, theme, setPreference }),
    [preference, theme, setPreference],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) throw new Error("useTheme используется вне ThemeProvider");
  return context;
}
