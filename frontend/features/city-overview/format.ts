import { formatNumber, formatPercent } from "@/lib/format/numbers";

/**
 * Форматирование обзора (ru-RU). Только вывод полученных значений.
 * Score и показатели — общий формат lib/format (два знака после запятой).
 */
export const formatScore = formatNumber;

/** Доля населения 0..1. */
export const formatShare = formatPercent;

const compact = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

/** Бюджет, горизонт, порог: без лишних нулей, дробная часть сохраняется. */
export function formatAmount(value: number): string {
  return compact.format(value);
}

/** Русское склонение: plural(3, ["показатель", "показателя", "показателей"]). */
export function plural(count: number, forms: readonly [string, string, string]): string {
  const n = Math.abs(count);
  if (!Number.isInteger(n)) return forms[1];
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
