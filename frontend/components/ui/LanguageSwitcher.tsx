"use client";

import { useLocale, type Locale } from "@/lib/i18n";
import { LANGUAGE_OPTIONS, uiMessages } from "./messages";
import styles from "./LanguageSwitcher.module.css";

export interface LanguageSwitcherProps {
  readonly className?: string;
}

/**
 * Компактный выбор языка: видимые РУС / ҚАЗ / ENG, доступное имя — полное
 * название текущего языка. Нативный select: клавиатура и экранные чтецы из коробки.
 */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();
  const copy = uiMessages[locale];
  const current = LANGUAGE_OPTIONS.find((option) => option.value === locale) ?? LANGUAGE_OPTIONS[0];

  return (
    <span className={className ? `${styles.wrap} ${className}` : styles.wrap}>
      <select
        className={styles.select}
        value={locale}
        aria-label={`${copy.languageLabel}: ${current.name}`}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} lang={option.value} title={option.name}>
            {option.short}
          </option>
        ))}
      </select>
      <svg className={styles.chevron} viewBox="0 0 12 12" aria-hidden="true">
        <path d="M3 4.5 6 7.5l3-3" />
      </svg>
    </span>
  );
}
