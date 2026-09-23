/**
 * Отображение Planner на выбранном языке. Чистые функции без React: правила и
 * validateDraft не меняются, здесь только перевод кодов и исходных данных в текст.
 * Относительный импорт каталога — чтобы модуль работал в node:test без алиаса @/.
 */
import type {
  CategoryId,
  ChoiceDraft,
  DistrictId,
  DraftValidation,
  IndicatorId,
  MeasureId,
  ScenarioVM,
  SelectionIssue,
} from "@/lib/contracts/ui";
import {
  categoryName,
  districtName,
  incompatibilityReason,
  indicatorName,
  intlLocales,
  measureName,
  type Locale,
} from "../../lib/i18n/catalog";
import { plannerMessages, type PlannerCopy } from "./messages";
import type { AddBlockReason, DistrictConflict } from "./selection-rules";

export interface PlannerText {
  readonly locale: Locale;
  readonly copy: PlannerCopy;
  readonly units: (value: number) => string;
  readonly signed: (value: number) => string;
  readonly measure: (id: MeasureId) => string;
  readonly district: (id: DistrictId) => string;
  readonly category: (id: CategoryId) => string;
  readonly indicator: (id: IndicatorId) => string;
  readonly reason: (pair: readonly [MeasureId, MeasureId], fallback: string) => string;
}

/** Названия берутся из каталога GPT по ID; неизвестный ID сохраняет название из API. */
export function createPlannerText(locale: Locale, scenario: ScenarioVM): PlannerText {
  const intl = intlLocales[locale];
  const unitsFormat = new Intl.NumberFormat(intl, { maximumFractionDigits: 2 });
  const signedFormat = new Intl.NumberFormat(intl, { maximumFractionDigits: 2, signDisplay: "exceptZero" });
  const measureNames = new Map(scenario.measures.map((m) => [m.id, m.name]));
  const districtNames = new Map(scenario.districts.map((d) => [d.id, d.name]));
  const indicatorNames = new Map(scenario.indicators.map((i) => [i.id, i.name]));
  return {
    locale,
    copy: plannerMessages[locale],
    units: (value) => unitsFormat.format(value),
    signed: (value) => signedFormat.format(value),
    measure: (id) => measureName(id, locale, measureNames.get(id) ?? id),
    district: (id) => districtName(id, locale, districtNames.get(id) ?? id),
    category: (id) => categoryName(id, locale),
    indicator: (id) => indicatorName(id, locale, indicatorNames.get(id) ?? id),
    reason: (pair, fallback) => incompatibilityReason(pair, locale, fallback),
  };
}

/** «уже выбрана M4. <причина>» на текущем языке. */
export function describeConflict(conflict: DistrictConflict, t: PlannerText): string {
  return t.copy.conflictText(conflict.partner, t.reason(conflict.pair, conflict.reason));
}

export function describeBlock(reason: AddBlockReason, t: PlannerText): string {
  const block = t.copy.block;
  switch (reason.kind) {
    case "rules-unavailable":
      return block.rulesUnavailable;
    case "unknown-measure":
      return block.unknownMeasure(reason.measureId);
    case "plan-full":
      return block.planFull(reason.count, reason.required);
    case "category-limit":
      return block.categoryLimit(t.category(reason.category), reason.measureIds.length, reason.measureIds.join(", "));
    case "incompatible":
      return block.incompatible(reason.partner, t.reason(reason.pair, reason.reason));
    case "budget":
      return block.budget(t.units(reason.shortfall));
    case "district-conflict":
      return block.districtConflict(
        t.district(reason.districtId),
        reason.conflict.partner,
        t.reason(reason.conflict.pair, reason.conflict.reason),
      );
    case "unknown-district":
      return block.unknownDistrict(reason.districtId);
    case "all-districts-conflict":
      return block.allDistricts;
  }
}

/**
 * Текст причины из validateDraft по code и исходным данным (scenario, choices,
 * validation). Русский issue.message не разбирается; он остаётся для совместимости.
 */
export function describeIssue(
  issue: SelectionIssue,
  scenario: ScenarioVM,
  choices: readonly ChoiceDraft[],
  validation: DraftValidation,
  t: PlannerText,
): string {
  const copy = t.copy.issue;
  const first = issue.measureIds?.[0] ?? "";
  const rules = scenario.rules;
  switch (issue.code) {
    case "rules-unavailable":
      return copy.rulesUnavailable;
    case "choice-count": {
      const required = rules?.requiredChoices ?? choices.length;
      return choices.length < required
        ? copy.tooFew(choices.length, required)
        : copy.tooMany(choices.length, required);
    }
    case "duplicate-measure":
      return copy.duplicate(first, choices.filter((choice) => choice.measureId === first).length);
    case "unknown-measure":
      return copy.unknownMeasure(first);
    case "district-for-city":
      return copy.districtForCity(first);
    case "district-required":
      return copy.districtRequired(first);
    case "invalid-district":
      return copy.invalidDistrict(first, issue.districtId ?? "");
    case "budget-exceeded":
      return copy.budgetExceeded(
        t.units(validation.provisionalSpent),
        t.units(scenario.budget),
        t.units(validation.provisionalSpent - scenario.budget),
      );
    case "category-limit": {
      const category = scenario.measures.find((measure) => measure.id === first)?.category;
      const ids = issue.measureIds ?? [];
      return copy.categoryLimit(category ? t.category(category) : "—", ids.length, rules?.maxPerCategory ?? 0);
    }
    case "incompatible": {
      const [a = "", b = ""] = issue.measureIds ?? [];
      const rule = rules?.incompatibilities.find(
        ({ measureIds: [x, y] }) => (x === a && y === b) || (x === b && y === a),
      );
      const reason = rule ? t.reason(rule.measureIds, rule.reason) : "";
      return issue.districtId !== undefined
        ? copy.incompatibleDistrict(a, b, t.district(issue.districtId), reason)
        : copy.incompatibleGlobal(a, b, reason);
    }
  }
}
