import type { DistrictVM, IndicatorVM } from "@/lib/contracts/ui";

export interface IndicatorReading {
  readonly indicator: IndicatorVM;
  readonly value: number;
  /** Строго ниже порога из scenario; ровно на пороге — не критично. */
  readonly isCritical: boolean;
}

export interface DistrictSummary {
  readonly district: DistrictVM;
  readonly readings: readonly IndicatorReading[];
  /** Показатели ниже порога, от самого низкого. */
  readonly critical: readonly IndicatorReading[];
  readonly weakest: IndicatorReading | null;
}

/**
 * Отбор и сортировка исходных значений для показа.
 * Не агрегирует показатели в балл района и не прогнозирует изменения.
 */
export function summarizeDistrict(
  district: DistrictVM,
  indicators: readonly IndicatorVM[],
  criticalThreshold: number,
): DistrictSummary {
  const readings = indicators.map<IndicatorReading>((indicator) => {
    const value = district.indicators[indicator.id];
    return { indicator, value, isCritical: value < criticalThreshold };
  });

  const ascending = readings.slice().sort((a, b) => a.value - b.value);

  return {
    district,
    readings,
    critical: ascending.filter((reading) => reading.isCritical),
    weakest: ascending[0] ?? null,
  };
}
