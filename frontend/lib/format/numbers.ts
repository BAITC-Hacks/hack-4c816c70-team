import type { IntlLocale } from "@/lib/i18n";

/** Keep native grouping/signs but enforce the API's decimal convention for Kazakh. */
function formatted(value: number, locale: IntlLocale, options: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).formatToParts(value)
    .map((part) => part.type === "decimal" && locale === "kk-KZ" ? "," : part.value).join("");
}

export const formatNumber = (value: number, locale: IntlLocale = "ru-RU") => formatted(value, locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
export const formatInteger = (value: number, locale: IntlLocale = "ru-RU") => formatted(value, locale, { maximumFractionDigits: 0 });
export const formatSigned = (value: number, locale: IntlLocale = "ru-RU") => `${value > 0 ? "+" : ""}${formatNumber(value, locale)}`;
export const formatPercent = (value: number, locale: IntlLocale = "ru-RU") => formatted(value, locale, { style: "percent", maximumFractionDigits: 0 });
