"use client";

import { useId } from "react";
import { useTheme } from "./ThemeProvider";
import type { ThemePreference } from "./theme-store";
import { useLocale } from "@/lib/i18n";
import { uiMessages } from "./messages";
import styles from "./ThemeSwitcher.module.css";

const OPTIONS: readonly ThemePreference[] = ["system", "light", "dark", "paper"];

function ThemeIcon({ value }: { value: ThemePreference }) {
  switch (value) {
    case "light":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="10" cy="10" r="3.5" />
          <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
        </svg>
      );
    case "dark":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M15.5 12.3A6 6 0 0 1 7.7 4.5a6 6 0 1 0 7.8 7.8Z" />
        </svg>
      );
    case "paper":
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M5 3.5h7l3 3v10H5z" />
          <path d="M12 3.5v3h3M7.5 10h5M7.5 13h5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="3" y="4" width="14" height="10" rx="1.5" />
          <path d="M7.5 17h5M10 14v3" />
        </svg>
      );
  }
}

export interface ThemeSwitcherProps {
  readonly className?: string;
}

/** Переключатель темы: группа радиокнопок, стрелки работают нативно. */
export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { preference, setPreference } = useTheme();
  const name = useId();
  const copy = uiMessages[useLocale().locale];

  return (
    <fieldset className={className ? `${styles.switcher} ${className}` : styles.switcher}>
      <legend className="visually-hidden">{copy.themeLegend}</legend>
      {OPTIONS.map((value) => {
        const id = `${name}-${value}`;
        const label = copy.themes[value];
        return (
          <span key={value} className={styles.option}>
            <input
              id={id}
              className={styles.input}
              type="radio"
              name={name}
              value={value}
              checked={preference === value}
              onChange={() => setPreference(value)}
            />
            <label htmlFor={id} className={styles.label} title={label}>
              <ThemeIcon value={value} />
              <span className="visually-hidden">{label}</span>
            </label>
          </span>
        );
      })}
    </fieldset>
  );
}
