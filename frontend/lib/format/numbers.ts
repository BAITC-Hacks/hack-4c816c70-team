import type { IntlLocale } from "@/lib/i18n";

export const formatNumber = (value: number, locale: IntlLocale = "ru-RU") => new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
export const formatInteger = (value: number, locale: IntlLocale = "ru-RU") => new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
export const formatSigned = (value: number, locale: IntlLocale = "ru-RU") => `${value > 0 ? "+" : ""}${formatNumber(value, locale)}`;
export const formatPercent = (value: number, locale: IntlLocale = "ru-RU") => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value);
