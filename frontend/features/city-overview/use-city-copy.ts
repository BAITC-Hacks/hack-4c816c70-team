"use client";

import { useMemo } from "react";
import { districtName, indicatorName, useLocale } from "@/lib/i18n";
import type { DistrictVM, IndicatorVM } from "@/lib/contracts/ui";
import { formatAmount, formatScore, formatShare } from "./format";
import { cityMessages } from "./messages";

/** Тексты, форматирование и названия каталога для текущего языка. */
export function useCityCopy() {
  const { locale, intlLocale } = useLocale();
  return useMemo(
    () => ({
      locale,
      copy: cityMessages[locale],
      score: (value: number) => formatScore(value, intlLocale),
      amount: (value: number) => formatAmount(value, intlLocale),
      share: (value: number) => formatShare(value, intlLocale),
      district: (district: Pick<DistrictVM, "id" | "name">) => districtName(district.id, locale, district.name),
      indicator: (indicator: Pick<IndicatorVM, "id" | "name">) => indicatorName(indicator.id, locale, indicator.name),
    }),
    [locale, intlLocale],
  );
}

export type CityCopy = ReturnType<typeof useCityCopy>;
