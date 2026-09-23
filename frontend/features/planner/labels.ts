import type { CategoryId } from "@/lib/contracts/ui";

/** Порядок фильтров каталога. Подписи — UI-строки, не данные сценария. */
export const CATEGORY_ORDER: readonly CategoryId[] = [
  "transport",
  "ecology",
  "social",
  "safety",
  "services",
];

export const CATEGORY_LABELS: Readonly<Record<CategoryId, string>> = {
  transport: "Транспорт",
  ecology: "Экология",
  social: "Социальная сфера",
  safety: "Безопасность",
  services: "Городские сервисы",
};

const unitsFormat = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const signedFormat = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

/** Только для вывода: исходные значения не округляются при проверке. */
export function formatUnits(value: number): string {
  return unitsFormat.format(value);
}

export function formatSigned(value: number): string {
  return signedFormat.format(value);
}
