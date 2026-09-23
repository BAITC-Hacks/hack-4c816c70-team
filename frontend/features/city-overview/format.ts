/**
 * Форматирование обзора по языку интерфейса (ru-RU / kk-KZ / en-US).
 * Только вывод полученных значений; склонения — в messages.ts по языку.
 */
const cache = new Map<string, Intl.NumberFormat>();

function formatter(intlLocale: string, key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const id = `${intlLocale}|${key}`;
  let value = cache.get(id);
  if (!value) {
    value = new Intl.NumberFormat(intlLocale, options);
    cache.set(id, value);
  }
  return value;
}

/** Score и показатели: всегда два знака после запятой. */
export function formatScore(value: number, intlLocale: string): string {
  return formatter(intlLocale, "score", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

/** Бюджет, горизонт, порог: без лишних нулей. */
export function formatAmount(value: number, intlLocale: string): string {
  return formatter(intlLocale, "amount", { maximumFractionDigits: 2 }).format(value);
}

/** Доля населения 0..1. */
export function formatShare(share: number, intlLocale: string): string {
  return formatter(intlLocale, "share", { style: "percent", maximumFractionDigits: 0 }).format(share);
}
