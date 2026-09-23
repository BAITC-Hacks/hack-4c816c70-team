export const formatNumber = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
export const formatInteger = (value: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
export const formatSigned = (value: number) => `${value > 0 ? "+" : ""}${formatNumber(value)}`;
export const formatPercent = (value: number) => new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: 0 }).format(value);
