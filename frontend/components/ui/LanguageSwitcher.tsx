"use client";

import { useLocale, type Locale } from "@/lib/i18n";
import { LANGUAGE_OPTIONS, uiMessages } from "./messages";
import styles from "./LanguageSwitcher.module.css";
import { Select } from "./Select";

export interface LanguageSwitcherProps {
  readonly className?: string;
}

/**
 * Компактный выбор языка: видимые РУС / ҚАЗ / ENG, доступное имя — полное
 * название текущего языка. Общий combobox с клавиатурным управлением.
 */
export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();
  const copy = uiMessages[locale];
  const current = LANGUAGE_OPTIONS.find((option) => option.value === locale) ?? LANGUAGE_OPTIONS[0];

  return (
    <span className={className ? `${styles.wrap} ${className}` : styles.wrap}>
      <Select
        compact
        value={locale}
        displayValue={current.short}
        ariaLabel={`${copy.languageLabel}: ${current.name}`}
        onChange={(value) => setLocale(value as Locale)}
        options={LANGUAGE_OPTIONS.map((option) => ({ value: option.value, label: option.name, lang: option.value }))}
      />
    </span>
  );
}
