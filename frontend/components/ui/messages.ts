import type { Locale } from "@/lib/i18n";
import type { ThemePreference } from "./theme-store";

export interface UiMessages {
  readonly navLabel: string;
  readonly themeLegend: string;
  readonly themes: Readonly<Record<ThemePreference, string>>;
  readonly languageLabel: string;
}

export const uiMessages: Readonly<Record<Locale, UiMessages>> = {
  ru: {
    navLabel: "Разделы",
    themeLegend: "Тема оформления",
    themes: { system: "Системная", light: "День", dark: "Ночь", paper: "Бумага" },
    languageLabel: "Язык интерфейса",
  },
  kk: {
    navLabel: "Бөлімдер",
    themeLegend: "Безендіру тақырыбы",
    themes: { system: "Жүйелік", light: "Күндізгі", dark: "Түнгі", paper: "Қағаз" },
    languageLabel: "Интерфейс тілі",
  },
  en: {
    navLabel: "Sections",
    themeLegend: "Color theme",
    themes: { system: "System", light: "Day", dark: "Night", paper: "Paper" },
    languageLabel: "Interface language",
  },
};

/** Видимые и доступные названия языков — одинаковые в любом интерфейсе. */
export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: Locale; short: string; name: string }> = [
  { value: "ru", short: "РУС", name: "Русский" },
  { value: "kk", short: "ҚАЗ", name: "Қазақша" },
  { value: "en", short: "ENG", name: "English" },
];
